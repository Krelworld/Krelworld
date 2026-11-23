const L = require('./lib.js');
(async () => {
  for (const view of ['port', 'land']) {
    const g = await L.boot({ view, room: 'kitchen' }); await g.calm(); const P = g.page;
    await P.evaluate(async () => { marina.stop(); marina.x = 200; await new Promise(q => setTimeout(q, 1500)); });
    for (const f of [0.3, 0.45, 0.6, 0.75]) {
      const r = await P.evaluate(async f => {
        G.busy = false; G.sceneOn = false; UI.closeActions(); G.holding = null; for (const e of [mommy, rory]) e.room = 'dining';
        AI.hold(daddy, true); daddy.stop(); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.y = 164; daddy.x = E.camX + f * E.viewW; G.septic = true;
        await new Promise(q => setTimeout(q, 2600));
        const [sx, sy] = toScreen(daddy.x, daddy.y - 104), box = [sx - 31, sy - 31, sx + 31, sy + 31];
        const hits = Clarity.hudRects(null, { except: ['give', 'call'], fresh: true }).filter(h => Math.min(h[0][3], box[3]) > Math.max(h[0][1], box[1])).map(h => h[2] + '[' + h[0].map(Math.round).join(',') + ']' + (h[3].id || h[3].className));
        const says = [...document.querySelectorAll('#fx .say')].map(n => n.textContent + ' ' + JSON.stringify(Clarity.G5.box(n).map(Math.round)));
        return { f, box: box.map(Math.round), wanted: Clarity.G26.wanted(), shown: !!document.querySelector('.cm-call'), rowHits: hits, says, W: Clarity.stageRect().width };
      }, f);
      console.log(view, JSON.stringify(r));
    }
    await g.close();
  }
})();

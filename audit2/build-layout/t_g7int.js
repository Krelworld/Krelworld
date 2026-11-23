// G19 x G7 (integration): keyboard (8) and TV (9) choice lists at 667x375 and 844x390: ring or tray, and are all choices visible
// without scrolling? (in this worktree G7 is not present; the expected result after merging rings is: all visible)
const { boot, MINE } = require('./lib.js');
(async () => {
  for (const view of ['landSmall', 'land']) for (const [mode, off] of [['TODAY', MINE], ['G19', 'G4,G13,G14']]) {
    const g = await boot({ view, room: 'playroom', off }); const p = g.page; const out = {};
    for (const [room, kind] of [['playroom', 'keyboard'], ['living', 'tv']]) {
      await g.calm(); await p.evaluate(r => travelTo(r), room); await p.waitForTimeout(1200); await g.calm();
      out[kind] = await p.evaluate(async kind => { const q = PROPS[G.room].find(o => o.a === kind); if (!q) return 'no prop'; marina.x = clamp(q.x - 30, 20, ROOMS[G.room].w - 20); marina.stop(); await new Promise(r => setTimeout(r, 1200)); G.busy = false;
        const list = propActions(q); UI.actions({ prop: q }, list); await new Promise(r => setTimeout(r, 500));
        const tray = document.querySelector('#fx .acttray'), acts = [...document.querySelectorAll('#fx .act')], st = document.getElementById('stage').getBoundingClientRect(), box = tray ? tray.getBoundingClientRect() : st;
        const hidden = acts.filter(n => { const r = n.getBoundingClientRect(); return r.left < box.left - 1 || r.right > box.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1; }).length;
        const r = { n: list.length, tray: !!tray, notFullyVisible: hidden, scrollW: tray ? tray.scrollWidth : null, clientW: tray ? tray.clientWidth : null }; UI.closeActions(); return r; }, kind);
    }
    console.log(view, mode, JSON.stringify(out), JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    await g.close();
  }
})();

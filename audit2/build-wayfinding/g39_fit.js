// G39: the two-glyph arrival picture stays fully on screen at 375 px (and in the other views); where is Marina relative to it
const { boot, OUT } = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  for (const view of ['portSmall', 'port', 'landSmall', 'land']) {
    const g = await boot({ view, room: 'foyer' }); await g.calm();
    for (const [from, how] of [['foyer', 'up'], ['uphall', 'down'], ['kitchen', 'down']]) {
      await g.go(from, 1500);
      await g.ev(how => { window.__bi = null; const mo = new MutationObserver(r => { for (const m of r) for (const n of m.addedNodes) if (n.style && n.style.fontSize === '90px') window.__bi = n; }); mo.observe(document.getElementById('fx'), { childList: true }); window.__mo2 = mo; Floors.go(how === 'up' ? 1 : -1); }, how);
      await g.wait(420);
      R[view + ' ' + from + ' ' + how] = await g.ev(() => { const n = window.__bi; __mo2.disconnect(); if (!n) return null; const r = n.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); const m = Clarity.toClient(marina.x, marina.y - 40);
        return { text: n.textContent, box: [r.left, r.top, r.right, r.bottom].map(Math.round), inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, inStage: r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom, marinaMid: m.map(Math.round), transform: getComputedStyle(n).transform }; });
      if (view === 'portSmall' && how === 'up') await g.shot(OUT + 'shots/g39_fit_portSmall.png');
      await g.wait(800);
    }
    R[view + ' errors'] = g.realErrors(); await g.close();
  }
  fs.writeFileSync(OUT + 'g39_fit.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})();

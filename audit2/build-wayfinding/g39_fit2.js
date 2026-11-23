// arrival picture at 375/390 px wide, with G5's centring simulated (translate:-50% -50% instead of the overridden transform)
const { boot, OUT } = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  for (const view of ['portSmall', 'port', 'landSmall']) for (const g5 of [false, true]) {
    const g = await boot({ view, room: 'foyer' }); await g.calm();
    await g.ev(g5 => { window.__bi = null; new MutationObserver(r => { for (const m of r) for (const n of m.addedNodes) if (n.style && n.style.fontSize === '90px') { if (g5) { n.style.transform = ''; n.style.translate = '-50% -50%'; } window.__bi = n; } }).observe(document.getElementById('fx'), { childList: true }); Floors.go(1); }, g5);
    await g.wait(420);
    R[view + (g5 ? ' +G5' : '')] = await g.ev(() => { const n = window.__bi, r = n.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(n); const t = rg.getBoundingClientRect(); const m = Clarity.toClient(marina.x, marina.y - 40), top = Clarity.toClient(marina.x, marina.y - 85);
      return { text: JSON.stringify(n.textContent), lines: Math.round(t.height / 100), ink: [t.left, t.top, t.right, t.bottom].map(Math.round), onScreen: t.left >= 0 && t.right <= innerWidth, marinaHeadY: Math.round(top[1]), marinaMid: m.map(Math.round) }; });
    await g.shot(OUT + `shots/g39_fit2_${view}${g5 ? '_g5' : ''}.png`); await g.close();
  }
  console.log(JSON.stringify(R, null, 1));
})();

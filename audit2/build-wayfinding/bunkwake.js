// waking up (bedtimeNight, game.js:642-651) from Marina's room upstairs: ⬇️📺 and ☀️ both show for their normal times, nothing left after
const { boot, OUT } = require('./lib.js');
(async () => {
  for (const mode of ['on', 'off']) {
    const g = await boot({ view: 'port', room: 'kitchen', off: mode === 'off' ? 'G39' : '' }); await g.calm(); await g.go('mroom', 1600);
    await g.ev(() => { window.__icons = []; new MutationObserver(r => { for (const m of r) { for (const n of m.addedNodes) if (n.style && n.style.fontSize === '90px') { n.__t0 = performance.now(); __icons.push(n); } for (const n of m.removedNodes) if (n.__t0) n.__life = Math.round(performance.now() - n.__t0); } }).observe(document.getElementById('fx'), { childList: true }); bedtimeNight(); });
    await g.wait(9000);
    console.log(mode, JSON.stringify(await g.ev(() => ({ icons: __icons.map(n => n.textContent + ':' + (n.__life || 'still there')), room: G.room, night: G.night, busy: G.busy, left: document.querySelectorAll('#fx > div').length }))), g.realErrors());
    await g.close();
  }
})();

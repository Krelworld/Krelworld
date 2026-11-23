const { boot, TH } = require('./lib.js');
(async () => {
  for (const view of ['land', 'landSmall']) { const out = {};
    for (const mode of ['on', 'off']) {
      const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G38' : '', storage: { cm_builds: TH } }); await g.calm();
      await g.ev(() => openIsoMap()); await g.wait(700);
      out[mode] = await g.ev(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); return [...document.querySelectorAll('.isoroom')].map(n => { const b = n.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => v.toFixed(1)).join(','); }).join(' | '); });
      await g.close();
    }
    console.log(view, 'paused isoroom boxes identical:', out.on === out.off);
  }
})();

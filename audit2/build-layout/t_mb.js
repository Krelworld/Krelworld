const { boot, R } = require('./lib.js');
(async () => { const g = await boot({ view: 'landSmall', room: 'living', off: '' }); const p = g.page; await g.calm();
  await p.evaluate(() => Clarity.set('G19', false));
  for (const t of [100, 300, 600, 1200]) { await p.waitForTimeout(t); console.log(t, JSON.stringify(await p.evaluate(() => { const b = document.getElementById('moodbar'), cs = getComputedStyle(b), r = b.getBoundingClientRect(); return { r: [r.left, r.top, r.right, r.bottom].map(v => +v.toFixed(1)), tf: cs.transform, sc: cs.scale, tr: cs.translate, anim: b.getAnimations().map(a => a.animationName || a.id || a.constructor.name), cls: b.className, pos: cs.position }; }))); }
  await g.close(); })();

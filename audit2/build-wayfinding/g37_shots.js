const { boot, OUT, TH } = require('./lib.js');
(async () => {
  for (const view of ['port', 'portSmall', { width: 390, height: 664 }, 'land', 'landSmall']) {
    const vk = typeof view === 'string' ? view : view.width + 'x' + view.height;
    const g = await boot({ view, room: 'kitchen', storage: { cm_builds: TH } }); await g.calm();
    // four people in the kitchen
    await g.ev(() => { for (const e of [daddy, mommy, niko]) { e.room = 'kitchen'; e.hidden = false; e.x = marina.x + 30; } if (mommy.state === 'sit') mommy.state = 'idle'; });
    await g.ev(() => openIsoMap()); await g.wait(800);
    await g.shot(OUT + `shots/g37_map_kitchen_${vk}.png`);
    const info = await g.ev(() => { const t = document.querySelector('.isosvg text[data-r=kitchen]'); const f = document.querySelector('.cm-g37-face'); return { label: t && t.textContent, face: f ? [f.getAttribute('x'), f.getAttribute('y'), f.getAttribute('width')].join(',') : null }; });
    console.log(vk, JSON.stringify(info));
    await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300);
    await g.go('den', 1500); await g.ev(() => { nunu.room = 'den'; nunu.hidden = false; }); await g.ev(() => openIsoMap()); await g.wait(800);
    await g.shot(OUT + `shots/g37_map_den_${vk}.png`);
    console.log(vk, g.realErrors());
    await g.close();
  }
})();

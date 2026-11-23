// G38 checks: map geometry with/without G38 (landscape), strip colours per floor, TV hiding, strip over the garden art.
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const mapGeo = g => g.ev(() => {
  const rr = n => { const b = n.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => Math.round(v * 10) / 10).join(','); };
  const tiles = [...document.querySelectorAll('.fmaproom')].map(b => { const r = b.getBoundingClientRect(), c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: b.getAttribute('aria-label'), box: rr(b), own: !!c && (c === b || b.contains(c)), under: c && c.id === 'xFloat' }; });
  return { img: rr(document.querySelector('.isowrap img')), rooms: [...document.querySelectorAll('.isoroom')].map(rr).join(' | '), tiles, rows: [...document.querySelectorAll('.fmaprow')].map(n => (n.dataset.floor || '?') + ':' + getComputedStyle(n).backgroundColor + ':' + rr(n)) };
});
(async () => {
  const R = { map: {}, strip: {}, tv: {} };
  for (const view of ['land', 'landSmall', { width: 844, height: 340 }]) {
    const vk = typeof view === 'string' ? view : view.width + 'x' + view.height; R.map[vk] = {};
    for (const mode of ['on', 'off']) {
      const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G38' : '', storage: { cm_builds: TH } }); await g.calm();
      for (const room of ['kitchen', 'den', 'uphall']) {
        await g.go(room, 1500); await g.ev(() => openIsoMap()); await g.wait(700);
        R.map[vk][mode + ':' + room] = await mapGeo(g);
        if (room === 'den') await g.shot(OUT + `shots/g38_map_${vk}_${mode}.png`);
        await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300);
      }
      R.map[vk][mode + ':errors'] = g.realErrors(); await g.close();
    }
  }
  // strip background on every floor, on and off
  for (const view of ['port', 'land']) for (const mode of ['on', 'off']) {
    const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G38' : '', storage: { cm_builds: TH } }); await g.calm();
    const out = R.strip[view + ':' + mode] = {};
    for (const room of ['kitchen', 'den', 'kitchen', 'uphall', 'pool', 'backyard', 'treehouse_oak', 'kitchen']) {
      await g.go(room, 1500); await g.wait(400);
      out[room + (out[room] ? '2' : '')] = await g.ev(() => { const b = document.getElementById('roombar'); return (b.dataset.floor || '-') + ' ' + getComputedStyle(b).backgroundColor; });
      if (['pool', 'backyard', 'treehouse_oak', 'den', 'uphall'].includes(room)) await g.shot(OUT + `shots/g38_strip_${view}_${room}_${mode}.png`, { x: 0, y: 0, width: view === 'port' ? 390 : 844, height: 120 });
    }
    // the strip still hides while the TV is on in landscape (nav.js:217)
    await g.go('living', 1500); await g.ev(() => tvOn(showList()[0])); await g.wait(1200);
    R.tv[view + ':' + mode] = await g.ev(() => ({ tvon: document.getElementById('stage').classList.contains('tvon'), roombarOpacity: getComputedStyle(document.getElementById('roombar')).opacity, pill: getComputedStyle(document.getElementById('floorpill')).opacity }));
    out.errors = g.realErrors(); await g.close();
  }
  fs.writeFileSync(OUT + 'g38_check.json', JSON.stringify(R, null, 1));
  // compare map geometry on/off
  for (const vk of Object.keys(R.map)) for (const room of ['kitchen', 'den', 'uphall']) {
    const a = R.map[vk]['on:' + room], b = R.map[vk]['off:' + room];
    const tilesSame = JSON.stringify(a.tiles.map(t => t.box)) === JSON.stringify(b.tiles.map(t => t.box));
    console.log(vk, room, 'img same:', a.img === b.img, a.img, '| isoroom boxes same:', a.rooms === b.rooms, '| tile boxes same:', tilesSame, '| tiles own centre:', a.tiles.every(t => t.own), 'under xFloat:', a.tiles.filter(t => t.under).map(t => t.r).join(',') || 'none', '| rows:', a.rows.join(' ; '));
  }
  for (const vk of Object.keys(R.map)) console.log(vk, 'errors', R.map[vk]['on:errors'], R.map[vk]['off:errors']);
  console.log(JSON.stringify(R.strip, null, 1)); console.log(JSON.stringify(R.tv));
})().catch(e => { console.error(e); process.exit(1); });

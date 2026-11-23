// G39 (and G36 arrival icons): every cross-floor route, with G39 on and off (CLARITY_OFF=G39), records:
// the landing room and x, the number of #cv animations at the moment of arrival, the slide keyframe and the arrival picture.
// usage: node g39_routes.js [view]
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const view = process.argv[2] || 'port';
const INST = () => {
  window.__arr = []; const fx = () => [...document.querySelectorAll('#fx > div')].filter(n => n.style.fontSize === '90px').map(n => n.textContent);
  Floors.hooks.push((was, room) => { const a = E.cv.getAnimations(); __arr.push({ was, room, n: a.length, kf: a.map(x => { try { return x.effect.getKeyframes()[0].transform; } catch (e) { return '?'; } }).join('|'), big: fx().join(' ') }); });
};
// each route: [name, startRoom, setup(page) -> triggers the trip]
const tapSel = async (g, sel) => { await g.tap(sel); };
const act = (g, room, id, ico) => g.ev(([room, id, ico]) => { const p = PROPS[room].find(q => q.id === id); const a = propActions(p).find(x => x.ico === ico); if (!a) return 'no ' + ico; a.fn(); return 'ok'; }, [room, id, ico]);
const door = (g, room, id) => g.ev(([room, id]) => { const p = PROPS[room].find(q => q.id === id); useDoor(p); return 'ok'; }, [room, id]);
const ROUTES = [
  ['pill up main→up', 'foyer', g => tapSel(g, '#floorpill .fl.up')],
  ['pill down main→down', 'kitchen', g => tapSel(g, '#floorpill .fl.down')],
  ['pill up down→main', 'den', g => tapSel(g, '#floorpill .fl.up')],
  ['pill down up→main', 'uphall', g => tapSel(g, '#floorpill .fl.down')],
  ['map kitchen→den', 'kitchen', async g => { await g.ev(() => openIsoMap()); await g.wait(500); await g.tap('.fmaproom[aria-label=den]'); }],
  ['map kitchen→uphall', 'kitchen', async g => { await g.ev(() => openIsoMap()); await g.wait(500); await g.tap('.fmaproom[aria-label=uphall]'); }],
  ['map den→kitchen', 'den', async g => { await g.ev(() => openIsoMap()); await g.wait(500); await g.ev(() => { const pts = ISO.rooms.kitchen.polygon.map(q => q.join(',')).join(' '); const n = [...document.querySelectorAll('.isoroom')].find(x => x.getAttribute('points') === pts); n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); }],
  ['strip backyard→yard', 'backyard', g => tapSel(g, '#roombar .rb[data-r=yard]')],
  ['strip pool→backyard', 'pool', g => tapSel(g, '#roombar .rb[data-r=backyard]')],
  ['arrow yard→pool', 'yard', g => g.ev(() => { marina.x = 40; }).then(() => g.wait(800)).then(() => tapSel(g, '.navarrow.l'))],
  ['stairs 🪜 up', 'foyer', g => act(g, 'foyer', 'stairs', '🪜')],
  ['stairs 💺 up', 'foyer', g => act(g, 'foyer', 'stairs', '💺')],
  ['ustairs 🪜 down', 'uphall', g => act(g, 'uphall', 'ustairs', '🪜')],
  ['ustairs 💺 down', 'uphall', g => act(g, 'uphall', 'ustairs', '💺')],
  ['basement doorway', 'foyer', g => door(g, 'foyer', 'basedoor')],
  ['den stairs', 'den', g => door(g, 'den', 'bstairs')],
  ['back door', 'backyard', g => door(g, 'backyard', 'bkdoor')],
  ['Dutch door', 'den', g => door(g, 'den', 'dutch')],
  ['oak ladder', 'backyard', g => g.ev(() => { const p = PROPS.backyard.find(q => q.bl === 2 && q.b.spot === 'oak'); const a = propActions(p); const x = a.find(q => q.ico === '🪜') || a[0]; x.fn(); return a.map(q => q.ico).join(''); })],
  ['pine ladder', 'backyard', g => g.ev(() => { const p = PROPS.backyard.find(q => q.bl === 2 && q.b.spot === 'pine'); propActions(p).find(q => q.ico === '🪜').fn(); return 'ok'; })],
  ['hatch 🪜', 'treehouse_oak', g => act(g, 'treehouse_oak', 'th_hatch', '🪜')],
  ['hatch 🛝', 'treehouse_oak', g => act(g, 'treehouse_oak', 'th_hatch', '🛝')],
  ['pine hatch 🪜', 'treehouse_pine', g => act(g, 'treehouse_pine', 'th_hatch', '🪜')],
  ['alert 😭 from den', 'den', async g => { await g.ev(() => { miles.crying = true; miles.cryT = 60; }); await g.wait(1200); await tapSel(g, '#alerts .alertb'); }],
  ['wish 🍳 from backyard', 'backyard', async g => { await g.ev(() => showWish('cook')); await g.wait(900); await tapSel(g, '#wishBtn'); }],
  ['request from uphall', 'uphall', async g => { await g.ev(() => askRequest('cook')); await g.wait(900); await tapSel(g, '#reqBtn'); }],
  ['same floor arrow kitchen→playroom', 'kitchen', g => g.ev(() => { marina.x = 300; }).then(() => g.wait(800)).then(() => tapSel(g, '.navarrow.r'))],
  ['same floor strip den→nunuroom', 'den', g => tapSel(g, '#roombar .rb[data-r=nunuroom]')],
  ['same floor map den→laundry', 'den', async g => { await g.ev(() => openIsoMap()); await g.wait(500); await g.tap('.fmaproom[aria-label=laundry]'); }],
  ['bunk wake mroom→living', 'mroom', g => g.ev(() => { bedtimeNight(); })],
];
(async () => {
  const res = {};
  for (const mode of ['on', 'off']) {
    const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G39' : '', storage: { cm_builds: TH } }); await g.calm(); await g.ev(INST);
    res[mode] = {};
    for (const [name, start, run] of ROUTES) {
      await g.go(start, 1600); await g.ev(() => { G.busy = false; miles.crying = false; __arr = []; marina.state = 'idle'; });
      let r = 'ok'; try { r = await run(g); } catch (e) { r = 'ERR ' + e.message.slice(0, 80); }
      // wait for the trip (climbs take ~3 s) and the landing walk-in
      for (let i = 0; i < 40; i++) { await g.wait(150); if (await g.ev(() => __arr.length)) break; }
      const big1 = await g.ev(() => [...document.querySelectorAll('#fx > div')].filter(n => n.style.fontSize === '90px').map(n => n.textContent).join(' '));
      await g.wait(2600);
      const out = await g.ev(() => ({ arr: __arr.slice(), room: G.room, x: Math.round(marina.x), panel: !document.getElementById('panel').classList.contains('hidden'), left: document.querySelectorAll('#fx > div').length }));
      out.r = r; out.big1 = big1; res[mode][name] = out;
      if (mode === 'on' && name === 'bunk wake mroom→living') await g.shot(OUT + 'shots/g39_bunkwake_' + view + '.png');
      await g.ev(() => { if (!document.getElementById('panel').classList.contains('hidden')) UI.closePanel && UI.closePanel(); document.getElementById('panel').classList.add('hidden'); G.busy = false; });
      await g.wait(300);
    }
    res[mode].errors = g.realErrors(); await g.close();
  }
  const rows = [];
  for (const name of Object.keys(res.on)) {
    if (name === 'errors') continue; const a = res.on[name], b = res.off[name];
    const ok = a.room === b.room && Math.abs(a.x - b.x) <= 2;
    rows.push(`${ok ? 'SAME' : 'DIFF'}  ${name.padEnd(30)} on: ${a.room}@${a.x} anims=${a.arr.map(x => x.n).join(',')} kf=${a.arr.map(x => x.kf).join(',')} big=[${a.arr.map(x => x.big).join(',')}]  | off: ${b.room}@${b.x} anims=${b.arr.map(x => x.n).join(',')} kf=${b.arr.map(x => x.kf).join(',')} big=[${b.arr.map(x => x.big).join(',')}] ${a.r !== 'ok' ? 'r=' + a.r : ''}`);
  }
  rows.push('errors on: ' + JSON.stringify(res.on.errors) + ' off: ' + JSON.stringify(res.off.errors));
  console.log(rows.join('\n'));
  fs.writeFileSync(OUT + 'g39_routes_' + view + '.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

const L = require('./lib.js');
(async () => { for (const [v, off] of [['land'], ['landSmall'], ['375x553'], ['land', 'G25']]) { const g = await L.boot({ port: 8894, view: L.viewOf(v), room: 'kitchen', off }); await g.calm();
  await g.ev(() => { G.holding = { type: 'tp' }; miles.crying = false; miles.cryT = 999; daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 120; daddy.state = 'idle'; askRequest('story'); });
  await g.wait(800);
  const r = await g.ev(async () => { const s = document.getElementById('stopBtn'), q = document.getElementById('reqBtn'); let hits = 0, pts = 0, maxX = 0; const sb = s.getBoundingClientRect();
    for (let f = 0; f < 14; f++) { for (let x = Math.floor(sb.left); x < sb.right; x += 1) for (let y = Math.floor(sb.top); y < sb.bottom; y += 2) { pts++; const t = document.elementFromPoint(x, y); if (t && (t === q || q.contains(t))) { hits++; maxX = Math.max(maxX, sb.right - x); } } await new Promise(r => setTimeout(r, 90)); }
    const b = q.querySelector('b').getBoundingClientRect(), qb = q.getBoundingClientRect(); return { stop: [Math.round(sb.left), Math.round(sb.top), Math.round(sb.right), Math.round(sb.bottom)], req: [Math.round(qb.left), Math.round(qb.top), Math.round(qb.right)], badge: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], pointsInStopTakenByReq: hits, ofPoints: pts, deepestPx: Math.round(maxX) }; });
  console.log(v, off || 'on', JSON.stringify(r)); await g.close(); } })();

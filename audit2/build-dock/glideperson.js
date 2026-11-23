// G16: a real touch on Daddy, who stands in 👗's glide path, during the first glide: Daddy's choices open, not dress-up or the book
const L = require('./lib.js');
(async () => { for (const room of ['kitchen', 'living']) { const g = await L.boot({ port: 8891, view: 'port', room }); await g.calm();
  await g.ev(() => { G.holding = null; marina.state = 'idle'; marina.x = 60; miles.crying = false; miles.cryT = 999; for (const e of [mommy, rory, niko]) if (e.room === G.room) e.room = 'yard';
    // put Daddy on the dress button's old (right-hand) spot so the glide starts over him
    const st = document.getElementById('stage').getBoundingClientRect(); const w = Clarity.fromClient(st.right - 42, st.bottom - 60); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = w[0]; daddy.here = true; Clarity.G16.glides.dressBtn = 0; marina.moving = true; });
  await g.wait(600); await g.ev(() => { marina.moving = false; });
  await g.page.waitForFunction(() => !document.getElementById('dressBtn').classList.contains('off'), null, { polling: 'raf', timeout: 9000 });
  const pt = await g.ev(() => { const r = document.getElementById('dressBtn').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); const x = r.left + r.width / 2, y = Math.min(r.top + r.height / 2, st.bottom - 40); const t = document.elementFromPoint(x, y); return [x, y, getComputedStyle(document.getElementById('dressBtn')).pointerEvents, t && (t.id || t.className)]; });
  await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(1200);
  const r = await g.ev(() => ({ ring: [...document.querySelectorAll('.act')].map(n => n.textContent).join(''), ringFor: window.__lastAnchor || null, dressUp: !document.getElementById('panel').classList.contains('hidden'), stk: !!document.getElementById('stkBox'), walking: !!marina.moving }));
  await g.shot(L.OUT + 'shots/g16_glideperson_' + room + '.png'); console.log(room, JSON.stringify({ tapAt: pt, ...r }), g.errs()); await g.close(); } })();

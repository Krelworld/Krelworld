// G23: after 10 s untouched, does a wiggle fire in every main-floor room (Marina where she arrives), and is it on the picture?
const L = require('./lib.js');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G23' : '';
(async () => {
  const g = await L.boot({ port: 8860, view, room: 'yard', off }); await g.calm();
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  await ev(() => { window.__F = []; let b = G.bounce; Object.defineProperty(G, 'bounce', { configurable: true, get() { return b; }, set(v) { b = v; if (v && /features\.js:600/.test(new Error().stack || '')) {
    const p = PROPS[G.room].find(q => q.id === v.id); let bx; if (p.k.startsWith('p:')) bx = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; bx = visBox(p.k).map(n => n * sc); }
    const c = Clarity.toClient(p.x + (bx[0] + bx[2]) / 2, p.y + (bx[1] + bx[3]) / 2), el = document.elementFromPoint(c[0], c[1]); __F.push({ room: G.room, t: E.t, id: v.id, vis: !!el && el.id === 'cv' }); } } }); });
  const out = [];
  for (const room of ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom']) {
    await ev(r => { if (G.room !== r) travelTo(r); }, room); await wait(3000); await g.calm();
    await ev(() => { miles.crying = false; miles.poopy = false; G.poop = false; G.needTP = false; G.holding = null; if (window.clearWish) clearWish(); const q = document.getElementById('reqBtn'); if (q) q.remove(); marina.stop && marina.stop(); });
    const L0 = await ev(() => { lastInput = E.t; return E.t; }); let f = null;
    for (let i = 0; i < 60 && !f; i++) { await wait(400); f = await ev(L0 => __F.find(w => w.t > L0) || (E.t - L0 > 17 ? 'none by 17 s' : null), L0); }
    const mx = await ev(() => Math.round(marina.x));
    out.push(room + '@' + mx + ': ' + (typeof f === 'string' ? f : (f.t - L0).toFixed(1) + 's ' + f.id + (f.vis ? ' visible' : ' HIDDEN')));
  }
  console.log(view, off || 'on', out.join(' | '), 'errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

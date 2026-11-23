// G23: the idle wiggle never picks a prop whose middle is not on the picture (under ✋, an arrow, a face card, the strip,
// the mood column, or off-screen). Forces many wiggles per room (test-only: hintT and lastInput are pushed so the next
// frame's check passes with gap 4), records each wiggled prop and checks elementFromPoint at its centre independently.
//   node t_g23_see.js <view> [off]
const L = require('./lib.js'), fs = require('fs');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G23' : '';
const ROOMS_ = ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom', 'den', 'backyard'];
(async () => {
  const g = await L.boot({ port: 8860, view, room: 'kitchen', off }); await g.calm();
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  await ev(() => { window.__W = []; let b = G.bounce; Object.defineProperty(G, 'bounce', { configurable: true, get() { return b; }, set(v) { b = v; const st = new Error().stack || ''; if (v && /features\.js:600/.test(st)) {
    const p = PROPS[G.room].find(q => q.id === v.id); let bx; if (p.k.startsWith('p:')) bx = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; bx = visBox(p.k).map(n => n * sc); }
    const r = document.getElementById('stage').getBoundingClientRect(), s = toScreen(p.x + (bx[0] + bx[2]) / 2, p.y + (bx[1] + bx[3]) / 2), cx = s[0] + r.left, cy = s[1] + r.top, el = document.elementFromPoint(cx, cy);
    __W.push({ room: G.room, id: v.id, t: E.t, on: !!el && el.id === 'cv', under: el ? (el.id || String(el.className).split(' ')[0] || el.tagName) : 'offscreen' }); } } }); });
  const out = {};
  for (const room of ROOMS_) {
    await ev(r => { if (G.room !== r) travelTo(r); }, room); await wait(2800); await g.calm();
    await ev(() => { miles.crying = false; miles.poopy = false; G.poop = false; G.needTP = false; G.holding = null; if (window.clearWish) clearWish(); const q = document.getElementById('reqBtn'); if (q) q.remove(); marina.stop && marina.stop(); });
    await ev(() => UI.face('daddy', 'happy', 120000)); await wait(400);
    // what covers each candidate right now
    const cand = await ev(() => PROPS[G.room].filter(p => !p.nohit && propVisible(p) && p.a !== 'door').map(p => { let bx; if (p.k.startsWith('p:')) bx = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; bx = visBox(p.k).map(n => n * sc); }
      const r = document.getElementById('stage').getBoundingClientRect(), s = toScreen(p.x + (bx[0] + bx[2]) / 2, p.y + (bx[1] + bx[3]) / 2), el = document.elementFromPoint(s[0] + r.left, s[1] + r.top);
      return { id: p.id, on: !!el && el.id === 'cv', under: el ? (el.id || String(el.className).split(' ')[0] || el.tagName) : 'offscreen', see: Clarity.G23 ? Clarity.G23.see(p) : null }; }));
    const n0 = await ev(() => __W.length);
    for (let k = 0; k < 40; k++) { await ev(k => { lastInput = E.t - 30 - k * 0.001; hintT = 100; G.busy = false; }, k); await wait(60); }
    const ws = await ev(n0 => __W.slice(n0), n0);
    out[room] = { candidates: cand.length, onPicture: cand.filter(c => c.on).length, covered: cand.filter(c => !c.on).map(c => c.id + '<' + c.under), seeAgrees: cand.every(c => c.see === null || c.see === c.on),
      wiggles: ws.length, wiggledOff: ws.filter(w => !w.on).map(w => w.id + '<' + w.under), distinctWiggled: [...new Set(ws.map(w => w.id))].length };
    console.log(view, off || 'on', room, JSON.stringify(out[room]));
    if (room === 'kitchen') await g.shot(L.OUT + 'shots/g23_see_' + view + (off ? '_off' : '') + '_kitchen.png');
  }
  console.log('errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
  fs.writeFileSync(L.OUT + 'g23_see_' + view + (off ? '_off' : '') + '.json', JSON.stringify(out, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

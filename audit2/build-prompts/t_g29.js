// G29 (and G2's Minka gate): seeded hide-and-seek runs in the basement (virtual time). A walker follows the 🐾 hints:
// when paws show at an edge she goes to the next room that way; with no hint for 15 s she tries a random neighbour.
// In Minka's room she 'finds' her 2 s after the first cue she can see there. Found = before the 100 s timeout.
// Also checks: every far-room mew gets 3 🐾 at the edge toward Minka's room (G29 on) / about 60% (off).
// usage: node t_g29.js <on|off> <seed> <hides> [port]
const L = require('./lib.js'); const fs = require('fs');
const [mode = 'on', seedS = '1', hidesS = '5', portS = '8857'] = process.argv.slice(2);
const off = mode === 'on' ? '' : L.MINE, seed = +seedS, port = +portS;
let rs = seed * 7777 + 13; const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
const DOWN = ['nunuroom', 'den', 'storage', 'laundry'];
(async () => {
  const g = await L.boot({ port, room: 'den', off, virtual: true, seed }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' });
  await g.ev(() => { travelTo('den'); }); await g.run(2000);
  await g.ev(() => { window.__cues = []; let last = null; setInterval(() => { const H = Minka._debug.H; const n = H.on && H.cl ? H.cl.next : null; if (n !== last) { if (last != null && n != null) __cues.push([+E.t.toFixed(2), G.room === (H.spot && H.spot.room)]); last = n; } }, 50); });
  const hides = [];
  for (let h = 0; h < +hidesS; h++) {
    // Marina somewhere in the basement, Minka hides in another basement room
    const start = DOWN[Math.floor(rnd() * 4)]; let target = DOWN[Math.floor(rnd() * 4)]; if (target === start) target = DOWN[(DOWN.indexOf(start) + 1 + Math.floor(rnd() * 3)) % 4];
    await g.ev(r => { if (G.room !== r) travelTo(r); }, start); await g.run(1500);
    const spot = await g.ev(([r, k]) => { const ids = Minka.spots.filter(s => Minka.spotRooms[s] === r); Minka._debug.place(G.room, 200, 'sit'); return Minka.hideNow(ids[Math.floor(k * ids.length)]); }, [target, rnd()]);
    let tin = null; for (let i = 0; i < 80 && tin == null; i++) { await g.run(250); tin = await g.ev(() => { const h = Minka.state().hiding; return h && h.in ? Minka._debug.H.t0 : null; }); }
    if (tin == null) { hides.push({ start, target, spot, error: 'never tucked in' }); continue; }
    let lastHintT = tin, logN = await g.ev(() => __log.length), arrived = null, found = null, path = [start], ended = null;
    for (let s = 0; s < 115 && found == null; s++) {
      await g.run(1000);
      const st = await g.ev(([n, tin]) => ({ t: E.t, room: G.room, mv: !!marina.moving, hiding: Minka.state().hiding, paws: __log.slice(n).filter(e => e.type === 'paw2').map(e => e.side), n: __log.length, cuesHere: __cues.filter(c => c[0] > tin && c[1]).map(c => c[0]) }), [logN, tin]);
      logN = st.n;
      if (!st.hiding) { ended = +(st.t - tin).toFixed(1); break; }
      if (st.room === target) { if (arrived == null) arrived = st.t; const c = st.cuesHere.find(t => t >= arrived); if (c != null && st.t >= c + 2) { found = +(c + 2 - tin).toFixed(1); break; } continue; }
      let go = null;
      if (st.paws.length) { lastHintT = st.t; const side = st.paws[0]; const i = DOWN.indexOf(st.room) + side; if (i >= 0 && i < 4) go = DOWN[i]; }
      else if (st.t - lastHintT > 15) { lastHintT = st.t; const i = DOWN.indexOf(st.room), nb = [DOWN[i - 1], DOWN[i + 1]].filter(Boolean); go = nb[Math.floor(rnd() * nb.length)]; }
      if (go) { path.push(go); await g.ev(r => travelTo(r), go); }
    }
    hides.push({ start, target, spot, tin, tEnd: await g.ev(() => E.t), found: found != null && found <= 100, foundAtS: found, endedAtS: ended, path: path.join('>') });
    await g.ev(() => { const H = Minka._debug.H; }); await g.run(500);
  }
  // far-room mews and their paws
  const mews = await g.ev(() => { const out = []; const L2 = __log; for (let i = 0; i < L2.length; i++) { const e = L2[i]; if (e.type !== 'mew' || !e.far) continue;
    const paws = L2.filter(p => p.type === 'paw2' && p.t >= e.t && p.t <= e.t + 0.7); out.push({ t: e.t, room: e.room, paws: paws.length, sides: [...new Set(paws.map(p => p.side))].join(',') }); } return out; });
  for (const m of mews) { const h = hides.filter(h => h.tin != null && m.t >= h.tin - 0.01).pop(); /* a hide lasts until the next one tucks in */ m.target = h && h.target; m.expect = h ? Math.sign(DOWN.indexOf(h.target) - DOWN.indexOf(m.room)) : null; m.sideOk = m.paws ? m.sides === String(m.expect) : null; }
  const R = { mode, seed, hides, farMews: mews.length, farMewsWith3Paws: mews.filter(m => m.paws >= 3).length, farMewsNoPaws: mews.filter(m => m.paws === 0).length, pawsWrongSide: mews.filter(m => m.sideOk === false).length, mews, errors: L.errs(g) };
  fs.writeFileSync(L.OUT + 't_g29_' + mode + '_s' + seed + '.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ mode, seed, found: hides.filter(h => h.found).length + '/' + hides.length, farMews: R.farMews, with3: R.farMewsWith3Paws, none: R.farMewsNoPaws, wrongSide: R.pawsWrongSide, errors: R.errors }));
  await g.close();
})().catch(e => { console.error(e); process.exit(1); });

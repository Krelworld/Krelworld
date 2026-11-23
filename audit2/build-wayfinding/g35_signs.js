// G35 signs: for every sign, in port/portSmall/land/landSmall/844x340, with 0 and 47 px simulated insets, at both room ends,
// mid-room, the pill landing (x 104) and the door's own landing x: is it drawn, and if so does every point of it tap the door
// (hitTest = its prop, exitSignHit null), is it on the bare picture (elementFromPoint = #cv, no HUD over it)?
// usage: node g35_signs.js [views comma list] [insets comma list]
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const VIEWS = (process.argv[2] || 'port,portSmall,land,landSmall,844x340').split(',').map(v => /x/.test(v) ? { width: +v.split('x')[0], height: +v.split('x')[1] } : v);
const INSETS = (process.argv[3] || '0,47').split(',').map(Number);
const vkey = v => typeof v === 'string' ? v : v.width + 'x' + v.height;
const POS = { foyer: [10, 104, 136, 236, 262], uphall: [10, 104, 152, 'w'], den: [10, 104, 304, 474, 'w'], backyard: [10, 96, 200, 520, 'w'] };
const INSET_CSS = n => `#app{padding:${n}px ${n}px 21px ${n}px !important}@media (orientation:portrait){#app{padding:${n}px 0 34px 0 !important}}`;
(async () => {
  const R = {}; let bad = 0, drawn = 0, skipped = 0;
  for (const view of VIEWS) for (const inset of INSETS) {
    const key = vkey(view) + '/' + inset; R[key] = {};
    const g = await boot({ view, room: 'foyer', storage: { cm_builds: TH } }); await g.calm();
    if (inset) { await g.ev(css => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); dispatchEvent(new Event('resize')); }, INSET_CSS(inset)); await g.wait(500); }
    for (const room of Object.keys(POS)) {
      await g.go(room, 1500);
      for (const p0 of POS[room]) {
        const x = await g.ev(([room, p0]) => { const x = p0 === 'w' ? ROOMS[room].w - 10 : p0; G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.x = x; marina.state = 'idle'; marina.offY = 0;
          // keep the other people out of the doorways for this geometric check (people in front are checked separately)
          for (const e of ENTS) if (e !== marina && e.room === room) { e.stop && e.stop(); e.room = room === 'kitchen' ? 'dining' : 'kitchen'; }
          return x; }, [room, p0]);
        await g.wait(2200);
        // sample 8 frames over ~0.8 s
        const frames = [];
        for (let k = 0; k < 8; k++) {
          frames.push(await g.ev(() => {
            const now = performance.now(), out = [];
            for (const s of Clarity.G35.signs) {
              const rec = { id: s.p.id, drawn: !!s.at && now - s.at < 120, spot: s.spot && s.spot.map(Math.round) };
              if (rec.drawn) {
                const [cx, cy] = s.spot, b = [cx - 14, cy - 7.5, cx + 14, cy + 7.5], probs = [];
                for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) { const wx = b[0] + 0.5 + (b[2] - b[0] - 1) * i / 4, wy = b[1] + 0.5 + (b[3] - b[1] - 1) * j / 2; const h = hitTest(wx, wy); if (!h || h.kind !== 'prop' || h.p.id !== s.p.id) probs.push('hit@' + i + j + '=' + (h ? h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : '') : 'null')); if (exitSignHit(wx, wy)) probs.push('exitSign@' + i + j); }
                for (const [wx, wy] of [[cx, cy], [b[0] + 1, b[1] + 1], [b[2] - 1, b[1] + 1], [b[0] + 1, b[3] - 1], [b[2] - 1, b[3] - 1]]) { const [px, py] = Clarity.toClient(wx, wy), n = document.elementFromPoint(px, py); if (!n || n.id !== 'cv') probs.push('covered@' + Math.round(wx) + ',' + Math.round(wy) + '=' + (n ? (n.id || n.className || n.tagName) : 'none')); }
                rec.probs = probs; rec.client = Clarity.toClient(cx, cy).map(Math.round);
              }
              out.push(rec);
            }
            return out;
          }));
          await g.wait(100);
        }
        const per = {};
        for (const f of frames) for (const r of f) { const o = per[r.id] = per[r.id] || { drawn: 0, n: 0, probs: new Set(), spots: new Set() }; o.n++; if (r.drawn) { o.drawn++; (r.probs || []).forEach(p => o.probs.add(p)); o.spots.add(JSON.stringify(r.spot)); } }
        for (const id in per) { const o = per[id]; R[key][room + '/' + id + '@' + x] = { drawn: o.drawn + '/' + o.n, spots: [...o.spots].join(' '), probs: [...o.probs] }; if (o.drawn) drawn++; else skipped++; if (o.probs.size) bad++; }
        if (inset === 0 && (x === 104 || x === 10)) await g.shot(OUT + `shots/g35_${vkey(view)}_${room}_${x}.png`);
      }
    }
    R[key].errors = g.realErrors(); await g.close();
    console.log(key, JSON.stringify(R[key]));
  }
  fs.writeFileSync(OUT + 'g35_signs_' + VIEWS.map(vkey).join('_') + '.json', JSON.stringify(R, null, 1));
  console.log('TOTAL positions with sign drawn:', drawn, 'never drawn:', skipped, 'positions with a problem:', bad);
})().catch(e => { console.error(e); process.exit(1); });

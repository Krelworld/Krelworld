// G19 DONE check 1: screen rects of every control on/around the picture, G19 on vs today (my switches off), open and folded,
// at land, landSmall, 844x340 and with 47/59 px side insets (+21 bottom, via CDP so env() is real).
const { boot, OUT, MINE, R } = require('./lib.js'); const fs = require('fs');
const SEL = ['#bookBtn', '#dressBtn', '.navarrow.l', '.navarrow.r', '.facecard.show.right', '.facecard.show:not(.right)', '#weatherBtn', '#moodToggle', '#roombar', '#alerts', '#stopBtn', '#wishBtn', '#reqBtn', '#mapBtn', '#floorpill',
  '.mood[data-mood=love]', '.mood[data-mood=happy]', '.mood[data-mood=sad]', '.mood[data-mood=angry]', '.mood[data-mood=tantrum]'];
const CASES = [['land', null], ['landSmall', null], [{ width: 844, height: 340 }, null], ['land', { left: 47, right: 47, bottom: 21 }], ['land', { left: 59, right: 59, bottom: 21 }], ['landSmall', { left: 47, right: 47, bottom: 21 }]];
(async () => {
  const all = {};
  for (const [view, inset] of CASES) for (const off of [MINE, '']) {
    const name = (typeof view === 'string' ? view : view.width + 'x' + view.height) + (inset ? '_in' + inset.left : '');
    const g = await boot({ view, inset, room: 'kitchen', off }); const p = g.page; const out = {};
    const st = async (label, fn, wait) => { await g.calm(); await p.evaluate(fn); await p.waitForTimeout(wait || 2200);
      // measuring only: freeze the bob/pulse animations (they move rects by a few px at random phases)
      await p.evaluate(() => { let s = document.getElementById('t-noanim'); if (!s) { s = document.createElement('style'); s.id = 't-noanim'; s.setAttribute('data-clarity', 'test'); s.textContent = '.navarrow,.navarrow *,.mood,#wishBtn,#reqBtn,.alertb{animation:none!important;transition:none!important}'; document.head.append(s); } document.getElementById('moodbar').classList.remove('pulse'); });
      for (const fold of [false, true]) { await p.evaluate(f => document.getElementById('moodbar').classList.toggle('collapsed', f), fold); await p.waitForTimeout(120);
        out[label + (fold ? '/folded' : '/open')] = await R(p, SEL); }
      await p.evaluate(() => document.getElementById('moodbar').classList.remove('collapsed')); };
    // calm: 👗 📒 arrows strip 😊 faces
    await st('calm', () => { if (window.clearWish) clearWish(); document.querySelectorAll('#reqBtn').forEach(n => n.remove()); G.poop = false; miles.crying = false; for (const e of [daddy, mommy, rory, niko]) { e.room = 'dining'; } marina.x = 200; marina.state = 'idle'; }, 3000);
    // talking + alert: both face cards and the alert row
    await st('talk', () => { G.poop = true; daddy.room = 'kitchen'; daddy.here = true; daddy.hidden = false; daddy.x = Math.min(ROOMS.kitchen.w - 40, E.camX + E.viewW - 40); daddy.state = 'idle'; marina.x = E.camX + 50;
      UI.face('marina', 'happy', 9000); UI.face('daddy', 'happy', 9000); }, 1500);
    // stop button (sitting) and prompts
    await st('stop', () => { G.poop = false; marina.state = 'sit'; }, 900);
    await st('wish', () => { marina.state = 'idle'; showWish('cook'); }, 900);
    await st('req', () => { if (window.clearWish) clearWish(); askRequest('cook'); }, 900);
    // yard: weather
    await p.evaluate(() => { travelTo('yard'); }); await p.waitForTimeout(1500);
    await st('yard', () => { }, 600);
    all[name + (off ? ' TODAY' : ' G19')] = out;
    console.log(name, off ? 'TODAY' : 'G19', 'errors', JSON.stringify(g.errors));
    if (!off) await g.shot(OUT + 'shots/g19_rects_' + name + '.png');
    await g.close();
  }
  fs.writeFileSync(OUT + 'g19_rects.json', JSON.stringify(all, null, 1));
  // compare
  let worst = 0; const rows = [];
  for (const k of Object.keys(all)) { if (!k.endsWith(' G19')) continue; const base = k.replace(' G19', ' TODAY'), A = all[base], B = all[k];
    for (const s of Object.keys(B)) for (const sel of SEL) { const a = A[s][sel], b = B[s][sel];
      if (!a && !b) continue; if (!a || !b) { rows.push([k, s, sel, 'presence', JSON.stringify(a), JSON.stringify(b)]); continue; }
      if (a[2] - a[0] < 1 && b[2] - b[0] < 1 && sel !== '#alerts') continue;   // not shown in either
      const d = Math.max(...a.map((v, i) => Math.abs(v - b[i]))); if (d > 0.6) rows.push([k, s, sel, d.toFixed(1), JSON.stringify(a), JSON.stringify(b)]);
      if (!/navarrow|mood\[/.test(sel) || true) worst = Math.max(worst, sel.startsWith('.mood[') && s.endsWith('folded') ? 0 : d); } }
  for (const r of rows) console.log(r.join('  '));
  console.log('max diff (excluding folded faces, which are hidden on purpose):', worst.toFixed(2));
})();

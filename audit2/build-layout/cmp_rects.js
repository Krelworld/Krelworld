const all = require('./g19_rects.json');
const SEL = Object.keys(Object.values(Object.values(all)[0])[0]);
const anim = s => /navarrow|wishBtn|reqBtn|alerts/.test(s);   // these bob/pulse (CSS animations): compare with tolerance 4.5
let rows = [], max = {};
for (const k of Object.keys(all)) { if (!k.endsWith(' G19')) continue; const A = all[k.replace(' G19', ' TODAY')], B = all[k];
  for (const s of Object.keys(B)) for (const sel of SEL) { const a = A[s][sel], b = B[s][sel];
    if (sel.startsWith('.mood[') && s.endsWith('folded')) continue;   // folded faces: hidden today (display:none) and with G19 (visibility:hidden)
    if (!a || !b) { if (a || b) rows.push(['PRESENCE', k, s, sel, JSON.stringify(a), JSON.stringify(b)]); continue; }
    const zero = r => r[2] - r[0] < 1; if (zero(a) && zero(b)) continue;
    const d = Math.max(...a.map((v, i) => Math.abs(v - b[i]))); max[sel] = Math.max(max[sel] || 0, d);
    if (d > (anim(sel) ? 4.5 : 0.6)) rows.push([d.toFixed(1), k, s, sel, JSON.stringify(a), JSON.stringify(b)]); } }
for (const r of rows) console.log(r.join('  '));
console.log(JSON.stringify(Object.fromEntries(Object.entries(max).map(([k, v]) => [k, +v.toFixed(1)]))));

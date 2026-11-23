// newly covered living-room props: a prop whose centre was on the picture (cv) today and now is under a control, or whose covered
// share rises by more than 20 points, by a control other than the strip (the strip is the item's own subject: reported separately)
const res = require('./g4_cover.json');
const views = [...new Set(Object.keys(res).map(k => k.split(' ')[0]))];
for (const v of views) for (const mode of ['G4', 'G4+G19']) {
  const A = res[v + ' TODAY'], B = res[v + ' ' + mode]; const rows = [];
  for (const mx of [120, 300, 420, 560, 'L', 'R']) for (const st of ['calm', 'prompts']) {
    const a = A[mx][st].props, b = B[mx][st].props;
    for (const id of Object.keys(b)) { const pa = a[id], pb = b[id]; if (!pa || !pb || !pb.n) continue;
      const fa = pa.n ? pa.cov / pa.n : 0, fb = pb.cov / pb.n;
      const nonStrip = o => Object.keys(o.covBy).filter(k => k !== 'strip');
      const newCtl = nonStrip(pb).filter(k => !(k in pa.covBy));
      const centreWorse = pb.centre !== 'cv' && pb.centre !== 'off' && (pa.centre === 'cv' || pa.centre === 'off');
      if (centreWorse || (fb - fa > 0.2 && newCtl.length)) rows.push(`${mx}/${st} ${id}: today ${pa.cov}/${pa.n} ${JSON.stringify(pa.covBy)} centre ${pa.centre}  ->  ${pb.cov}/${pb.n} ${JSON.stringify(pb.covBy)} centre ${pb.centre}`);
    } }
  console.log('==', v, mode, rows.length ? '' : 'no prop newly under a control'); for (const r of rows) console.log('  ', r);
}
// the TV itself
for (const k of Object.keys(res)) { const out = []; for (const mx of [120, 300, 420, 560]) { const t = res[k][mx].calm.props.tv; if (t) out.push(mx + ':' + t.cov + '/' + t.n + ' ' + JSON.stringify(t.covBy) + ' c=' + t.centre); } console.log('TV', k.padEnd(18), out.join(' | ')); }
// lamp at the left end (landSmall)
for (const k of Object.keys(res)) { const out = []; for (const mx of ['L', 120]) { for (const id of Object.keys(res[k][mx].calm.props)) if (/lamp/.test(id)) { const t = res[k][mx].calm.props[id]; out.push(mx + ' ' + id + ':' + t.cov + '/' + t.n + ' ' + JSON.stringify(t.covBy) + ' c=' + t.centre); } } console.log('LAMP', k.padEnd(18), out.join(' | ')); }

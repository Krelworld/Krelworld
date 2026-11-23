// Compare two regress.js outputs.   node regress-diff.js before.json after.json [before2.json]
// before2.json is a second run of the SAME (unchanged) game: rows that already differ between before and before2 are
// naturally random (the game picks lines and events at random) and are reported as "noisy" instead of as regressions.
const fs = require('fs'); const [A, B, A2] = process.argv.slice(2, 5).map(f => f && JSON.parse(fs.readFileSync(f)));
const byKey = l => Object.fromEntries((l || []).map(c => [c.key, c]));
const rowKey = r => r.key + ' | ' + r.id;
const sig = r => JSON.stringify([r.result, !!r.stuck, (r.late || []).filter(x => !/^mess:|^overlays:/.test(x)).sort(), (r.errors || []).length > 0]);
const soft = r => JSON.stringify([(r.late || []).filter(x => /^mess:|^overlays:/.test(x)).sort(), r.saidKinds, r.saidN > 0]);
let hard = 0, warn = 0; const out = [];
// 1. is every choice still offered in every situation?
const ca = byKey(A.contexts), cb = byKey(B.contexts);
for (const k of Object.keys(ca)) { const a = ca[k], b = cb[k]; if (!b) { out.push('LOST SITUATION  ' + k); hard++; continue; }
  const cnt = l => l.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {}), na = cnt(a.ids), nb = cnt(b.ids);
  for (const id of Object.keys(na)) if ((nb[id] || 0) < na[id]) { out.push(`LOST CHOICE     ${k}: was [${a.icons}] now [${b.icons}] (handler ${id} ${na[id]}→${nb[id] || 0})`); hard++; }
  for (const id of Object.keys(nb)) if ((na[id] || 0) < nb[id]) { out.push(`new choice      ${k}: was [${a.icons}] now [${b.icons}]`); warn++; }
  if (a.icons !== b.icons && JSON.stringify(a.ids.slice().sort()) === JSON.stringify(b.ids.slice().sort())) out.push(`(look/order)    ${k}: [${a.icons}] → [${b.icons}]`); }
for (const k of Object.keys(cb)) if (!ca[k]) out.push('new situation   ' + k);
// 2. does every choice still do the same thing?
const ra = Object.fromEntries((A.results || []).map(r => [rowKey(r), r])), rb = Object.fromEntries((B.results || []).map(r => [rowKey(r), r])), r2 = A2 ? Object.fromEntries((A2.results || []).map(r => [rowKey(r), r])) : null;
let same = 0, noisy = 0;
for (const k of Object.keys(ra)) { const a = ra[k], b = rb[k]; if (!b) continue; const flaky = r2 && r2[k] && sig(r2[k]) !== sig(a);
  if (sig(a) === sig(b)) { same++; if (soft(a) !== soft(b) && !(r2 && r2[k] && soft(r2[k]) !== soft(a))) { out.push(`(minor)         ${k} ${a.ico}: said ${a.saidKinds}/${a.saidN} → ${b.saidKinds}/${b.saidN}; ${(a.late || []).filter(x => /^mess:|^overlays:/.test(x))} → ${(b.late || []).filter(x => /^mess:|^overlays:/.test(x))}`); } continue; }
  if (flaky) { noisy++; out.push(`(noisy)         ${k} ${a.ico}: differs, but it also differs between two runs of the unchanged game`); continue; }
  const bad = b.result !== 'ok' || b.stuck || (b.errors || []).length;
  out.push(`${bad ? 'BROKEN         ' : 'BEHAVES DIFF   '} ${k} ${a.ico}→${b.ico}\n      before: ${a.result}${a.stuck ? ' STUCK' : ''} ${JSON.stringify(a.late)} ${(a.errors || []).join(';')}\n      after:  ${b.result}${b.stuck ? ' STUCK' : ''} ${JSON.stringify(b.late)} ${(b.errors || []).join(';')}`); bad ? hard++ : warn++; }
// 3. end-to-end flows
const fa = A.flows || {}, fb = B.flows || {}, f2 = A2 ? A2.flows || {} : null;
for (const k of Object.keys(fa)) { if (fa[k] === fb[k]) continue; if (fb[k] === undefined) continue; const flaky = f2 && f2[k] !== undefined && f2[k] !== fa[k];
  out.push(`${flaky ? '(noisy flow)   ' : 'FLOW DIFFERS   '} ${k}\n      before: ${fa[k]}\n      after:  ${fb[k]}`); if (!flaky) (/FAILED|errors:/.test(fb[k]) ? hard++ : warn++); }
console.log(out.join('\n')); console.log(`\n${Object.keys(ca).length} situations, ${Object.keys(ra).length} choices pressed: ${same} identical, ${noisy} noisy.  HARD problems: ${hard}   differences to review: ${warn}`);
process.exit(hard ? 1 : 0);

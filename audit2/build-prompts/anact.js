// acttable for the on2/off2 act runs: after closing, first wish / request / alert, and wish timing vs the close
const fs = require('fs'); const D = __dirname + '/logs/'; const rows = {};
for (const f of fs.readdirSync(D).filter(f => /^(on2|off2)_.*act-/.test(f))) {
  const o = JSON.parse(fs.readFileSync(D + f)), Lg = o.log, mode = f.split('_')[0], key = f.replace(/^(on2|off2)_/, '').replace('.json', '');
  const cl = Lg.find(e => e.type === 'mark' && e.what === 'close'); if (!cl) continue;
  const fw = Lg.find(e => e.t >= cl.t && e.type === 'state' && e.k === 'wish' && e.v), fr = Lg.find(e => e.t >= cl.t && e.type === 'state' && e.k === 'req' && e.v);
  const fa = Lg.find(e => e.t >= cl.t && e.type === 'state' && e.k === 'alerts' && e.v);
  const wishes = Lg.filter(e => e.t >= cl.t && e.type === 'state' && e.k === 'wish' && e.v).length;
  (rows[key] = rows[key] || {})[mode] = { wish: fw ? +(fw.t - cl.t).toFixed(1) : null, req: fr ? +(fr.t - cl.t).toFixed(1) : null, alert: fa ? +(fa.t - cl.t).toFixed(1) + ' ' + fa.v : null, wishesAfter: wishes, post: Math.round(o.Et - cl.t), errors: o.meta.errors.length };
}
const fmt = r => r ? `wish+${r.wish} req+${r.req} alert+${r.alert} (#w ${r.wishesAfter}, post ${r.post}s, err ${r.errors})` : '-';
for (const k of Object.keys(rows).sort()) console.log(k.padEnd(34), 'ON', fmt(rows[k].on2).padEnd(66), 'OFF', fmt(rows[k].off2));
fs.writeFileSync(__dirname + '/anact.json', JSON.stringify(rows, null, 1));

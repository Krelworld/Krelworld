// G21: Rory's walk-up lines (the voice within 4 s after a walk-up) at most once per 90 s; the first one plays; all four keys heard
const fs = require('fs'); const D = __dirname + '/logs/'; const keys = { on: {}, off: {} }; const out = [];
for (const f of fs.readdirSync(D).filter(f => /^(on|off|on2|off2)_(dining|yard|main|outside)_(idle|walk)/.test(f))) {
  const o = JSON.parse(fs.readFileSync(D + f)), Lg = o.log, mode = f.startsWith('on') ? 'on' : 'off';
  const st = (Lg.find(e => e.type === 'mark' && e.what === 'start') || Lg[0]).t;
  const wu = Lg.filter(e => e.type === 'walkup' && e.t >= st);
  const lines = []; for (const w of wu) { const v = Lg.find(e => e.type === 'voice' && /^r_(giggle|hi_niece3|chase|hi_niece)$/.test(e.key) && e.t > w.t && e.t - w.t < 4 && e.room === w.room); if (v) lines.push([v.t, v.key]); }
  // stars too: walk-up callback emits stars right after the say; not logged separately (same branch)
  for (const [, k] of lines) keys[mode][k] = (keys[mode][k] || 0) + 1;
  let minGap = Infinity; for (let i = 1; i < lines.length; i++) minGap = Math.min(minGap, lines[i][0] - lines[i - 1][0]);
  const firstWalkupHasLine = wu.length ? !!lines.length && lines[0][0] - wu[0].t < 4 : null;
  if (wu.length) out.push({ mode, run: f.replace('.json', ''), walkups: wu.length, lines: lines.length, minGapS: lines.length > 1 ? +minGap.toFixed(0) : null, firstWalkupHasLine });
}
for (const r of out.sort((a, b) => a.run.localeCompare(b.run))) console.log(JSON.stringify(r));
console.log('keys', JSON.stringify(keys));
fs.writeFileSync(__dirname + '/an21.json', JSON.stringify({ out, keys }, null, 1));

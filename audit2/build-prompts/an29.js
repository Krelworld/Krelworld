const fs = require('fs'); const out = {};
for (const m of ['on', 'off']) { const o = { hides: 0, found: 0, foundTimes: [], farMews: 0, with3: 0, none: 0, firstSideWrong: 0, wrongCases: [] };
  for (const s of [1, 2, 3, 4]) { const r = JSON.parse(fs.readFileSync(__dirname + '/t_g29_' + m + '_s' + s + '.json'));
    for (const h of r.hides) { o.hides++; if (h.found) { o.found++; o.foundTimes.push(h.foundAtS); } }
    for (const x of r.mews) { o.farMews++; if (x.paws >= 3) o.with3++; if (!x.paws) o.none++; if (x.paws && x.sides.split(',')[0] !== String(x.expect)) { o.firstSideWrong++; o.wrongCases.push(x); } } }
  o.meanFoundS = +(o.foundTimes.reduce((a, b) => a + b, 0) / o.foundTimes.length).toFixed(1); o.medianFoundS = o.foundTimes.sort((a, b) => a - b)[o.foundTimes.length >> 1]; delete o.foundTimes;
  o.pawShare = +(o.with3 / o.farMews).toFixed(2); out[m] = o; }
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(__dirname + '/an29.json', JSON.stringify(out, null, 1));

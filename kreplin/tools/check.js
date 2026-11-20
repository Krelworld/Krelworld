// Syntax-check every <script> block in dist/KREPLIN.html, and report duplicate top-level
// function declarations inside the main script.
// Usage: node tools/check.js [file]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const file = process.argv[2] || path.join(__dirname, '..', 'dist', 'KREPLIN.html');
const html = fs.readFileSync(file, 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, n = 0, bad = 0;
const dupReport = [];
while ((m = re.exec(html))) {
  n++;
  const code = m[1];
  const line = html.slice(0, m.index).split('\n').length;
  try { new vm.Script(code, { filename: `script#${n}@L${line}` }); }
  catch (e) { bad++; console.log(`SYNTAX ERROR in script #${n} (starts L${line}): ${e.message}`); }
  const names = {};
  for (const fm of code.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names[fm[1]] = (names[fm[1]] || 0) + 1;
  const d = Object.entries(names).filter(([, c]) => c > 1);
  if (d.length) dupReport.push(`script #${n} (L${line}): ${d.length} duplicated top-level functions: ${d.map(([k, c]) => `${k}×${c}`).join(', ')}`);
}
console.log(`${n} script blocks, ${bad} with syntax errors`);
dupReport.forEach(l => console.log(l));
process.exit(bad ? 1 : 0);

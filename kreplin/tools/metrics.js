// Structural metrics for the built game (used to track consolidation progress).
// Usage: node tools/metrics.js [file]
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'dist', 'KREPLIN.html');
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
const count = re => (js.match(re) || []).length;
let dups = 0;
for (const code of scripts) {
  const names = {};
  for (const fm of code.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names[fm[1]] = (names[fm[1]] || 0) + 1;
  dups += Object.values(names).filter(c => c > 1).length;
}
const rows = {
  'lines (dist)': html.split('\n').length,
  'script blocks': scripts.length,
  'duplicate top-level functions': dups,
  'window.log reassignments': count(/\bwindow\.log\s*=(?!=)/g),
  'window.updateHUD reassignments': count(/\bwindow\.updateHUD\s*=(?!=)/g),
  'choose wrappers (window.choose =)': count(/\bwindow\.choose\s*=(?!=)/g),
  'console.log calls': count(/\bconsole\.log\s*\(/g),
  "console.log 'DEBUG'": count(/\bconsole\.log\s*\(\s*['"`][^'"`]*DEBUG/g),
  'console.warn calls': count(/\bconsole\.warn\s*\(/g),
  'console.error calls': count(/\bconsole\.error\s*\(/g),
  'setInterval calls': count(/\bsetInterval\s*\(/g),
  'MutationObservers': count(/new\s+MutationObserver\b/g),
  'ingest fetches (127.0.0.1:7242)': count(/127\.0\.0\.1:7242/g),
  'localStorage.setItem calls': count(/localStorage\.setItem\s*\(/g),
};
for (const [k, v] of Object.entries(rows)) console.log(`${k.padEnd(36)} ${v}`);

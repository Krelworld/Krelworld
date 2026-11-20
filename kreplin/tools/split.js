// One-time: split the original single-file KREPLIN.html into ordered source parts.
// Usage: node tools/split.js <original.html>
// Produces src/NNN-name.(html|css|js) + src/manifest.json. build.js concatenates them back.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.argv[2], 'utf8');
const lines = src.split('\n');
const outDir = path.join(__dirname, '..', 'src');
fs.mkdirSync(outDir, { recursive: true });

// Find top-level <style>/<script> blocks (tags at column 0).
const parts = [];
let buf = [], kind = 'html', startLine = 1;
const flush = (endKind) => {
  if (buf.length) parts.push({ kind, start: startLine, lines: buf });
  buf = [];
};
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (kind === 'html' && /^<(style|script)>\s*$/.test(l)) {
    buf.push(l); flush(); kind = l.includes('style') ? 'css' : 'js'; startLine = i + 2; continue;
  }
  if (kind !== 'html' && (/^<\/(style|script)>/.test(l))) {
    flush(); kind = 'html'; startLine = i + 1; buf.push(l); continue;
  }
  buf.push(l);
}
flush();

// Split very large JS parts at section-header comments for manageability.
const finalParts = [];
for (const p of parts) {
  if (p.kind === 'js' && p.lines.length > 4000) {
    let cur = [], curStart = p.start, label = 'core';
    for (let j = 0; j < p.lines.length; j++) {
      const l = p.lines[j];
      const m = /^\/\/ ?(?:=====+|-{5,}) ?(.+?) ?(?:=====+|-{5,})?\s*$/.exec(l);
      if (m && cur.length > 1500) {
        finalParts.push({ kind: 'js', start: curStart, lines: cur, label });
        cur = []; curStart = p.start + j; label = m[1];
      } else if (m && cur.length === 0) label = m[1];
      cur.push(l);
    }
    if (cur.length) finalParts.push({ kind: 'js', start: curStart, lines: cur, label });
  } else finalParts.push(p);
}

const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'part';
const manifest = [];
finalParts.forEach((p, idx) => {
  const firstReal = p.label || (p.lines.find(l => /\S/.test(l) && !/^<\/?(style|script)/.test(l)) || '');
  const name = `${String(idx).padStart(3, '0')}-${p.kind === 'html' ? 'markup' : slug(p.label || firstReal.replace(/[/*=\-]/g, ' '))}.${p.kind}`;
  fs.writeFileSync(path.join(outDir, name), p.lines.join('\n'));
  manifest.push(name);
});
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${manifest.length} parts written`);

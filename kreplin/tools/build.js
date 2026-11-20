// Concatenate src/ parts (in manifest order) into dist/KREPLIN.html.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
const out = manifest.map(n => fs.readFileSync(path.join(root, 'src', n), 'utf8')).join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'KREPLIN.html'), out);
console.log(`built dist/KREPLIN.html (${(out.length / 1e6).toFixed(2)} MB, ${manifest.length} parts)`);

// Make the claude.ai artifact build: dist/KREPLIN.html -> dist/KREPLIN.artifact.html
// with every Dropbox media URL rewritten to the artifact's own asset store (/_blob/<id>),
// because the artifact viewer's CSP blocks third-party media.
// Mapping (dropbox file id -> asset id) lives in tools/artifact-media-map.json.
// Usage: node tools/build.js && node tools/build-artifact.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifact-media-map.json'), 'utf8'));
let html = fs.readFileSync(path.join(root, 'dist', 'KREPLIN.html'), 'utf8');
let hits = 0;
const missing = new Set();
// Whole URL incl. query string, up to a quote/backtick/whitespace/paren/angle bracket/backslash.
html = html.replace(/https:\/\/(?:www|dl)\.dropbox(?:usercontent)?\.com\/scl\/fi\/([A-Za-z0-9]+)\/[^"'`\s)<>\\]+/g, (m, fid) => {
  if (map[fid]) { hits++; return '/_blob/' + map[fid]; }
  missing.add(fid); return m;
});
// Assets were re-encoded: music -> AAC in MP4, all video -> H.264 MP4. Fix declared types.
html = html.replace(/type=(["'])audio\/mpeg\1/g, 'type=$1audio/mp4$1').replace(/type=(["'])video\/quicktime\1/g, 'type=$1video/mp4$1');
fs.writeFileSync(path.join(root, 'dist', 'KREPLIN.artifact.html'), html);
console.log(`rewrote ${hits} media URLs; ${missing.size} unmapped${missing.size ? ': ' + [...missing].join(',') : ''}`);
const left = (html.match(/dropbox\.com/g) || []).length;
console.log(`remaining dropbox mentions: ${left}`);

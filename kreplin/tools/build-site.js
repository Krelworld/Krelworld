// Build the GitHub-hosted web version: site/index.html + site/media/<dropboxId>.<ext>
// Dropbox share links don't play reliably when embedded, so the web build serves the
// re-encoded media (see README: H.264 540p MP4 video, AAC .m4a music) from the repo.
// Source media: media-upload/ (re-encoded files named <dropboxId>-<name>.<ext>, git-ignored).
// Usage: node tools/build.js && node tools/build-site.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'media-upload');
const outDir = path.join(root, 'site');
const mediaOut = path.join(outDir, 'media');
fs.mkdirSync(mediaOut, { recursive: true });

// id -> published file name
const byId = {};
if (fs.existsSync(srcDir)) {
  for (const f of fs.readdirSync(srcDir)) {
    const id = f.split('-')[0];
    const ext = f.endsWith('.audio.mp4') ? 'm4a' : f.split('.').pop().toLowerCase();
    const name = `${id}.${ext}`;
    byId[id] = name;
    const dst = path.join(mediaOut, name);
    if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(path.join(srcDir, f)).size) {
      fs.copyFileSync(path.join(srcDir, f), dst);
    }
  }
} else {
  for (const f of fs.readdirSync(mediaOut)) byId[f.split('.')[0]] = f;
}

// Media is served by jsDelivr (correct MIME types + byte ranges, which iOS video needs), pinned to the
// commit that added site/media. githack (which serves index.html) mangles video requests.
// Override with MEDIA_BASE=media/ for a host that serves the folder itself (e.g. GitHub Pages).
const MEDIA_BASE = process.env.MEDIA_BASE || 'https://cdn.jsdelivr.net/gh/Krelworld/Krelworld@93d063792696fb0ff0996aebdd7c4a5b738149d1/kreplin/site/media/';
let html = fs.readFileSync(path.join(root, 'dist', 'KREPLIN.html'), 'utf8');
let hits = 0; const missing = new Set();
html = html.replace(/https:\/\/(?:www|dl)\.dropbox(?:usercontent)?\.com\/scl\/fi\/([A-Za-z0-9]+)\/[^"'`\s)<>\\]+/g, (m, id) => {
  if (byId[id]) { hits++; return MEDIA_BASE + byId[id]; }
  missing.add(id); return m;
});
html = html.replace(/type=(["'])audio\/mpeg\1/g, 'type=$1audio/mp4$1').replace(/type=(["'])video\/quicktime\1/g, 'type=$1video/mp4$1');
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`site/index.html: rewrote ${hits} media URLs, ${missing.size} unmapped; ${Object.keys(byId).length} media files in site/media`);

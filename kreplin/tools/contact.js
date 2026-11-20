// Render a contact sheet of art/raw/*.png (scaled, pixelated) to a PNG.
// Usage: node tools/contact.js out.png [filter-substring]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'art', 'raw');
const filt = process.argv[3] || '';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && f.includes(filt)).sort();
const html = `<body style="background:#222;color:#eee;font:12px monospace;display:flex;flex-wrap:wrap;gap:12px;padding:12px;margin:0">` +
  files.map(f => `<figure style="margin:0;text-align:center"><img src="file://${dir}/${f}" style="image-rendering:pixelated;height:${f.match(/office|stadium|bg-/) ? 324 : 192}px;background:#556"><figcaption>${f}</figcaption></figure>`).join('') + '</body>';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
  const tmp = path.join(dir, '..', '_sheet.html'); fs.writeFileSync(tmp, html); await p.goto('file://' + tmp);
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
})();

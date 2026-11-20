// Generate pixel art via PixelLab (key is injected by the environment proxy).
// Usage: node tools/pixellab.js art/specs/batch.json [--only name1,name2] [--force]
// Spec file: [{ "name": "delmor", "description": "...", "w": 96, "h": 96, "nobg": true,
//              "outline": "single color black outline", "shading": "medium shading",
//              "detail": "medium detail", "view": "side", "seed": 1 }]
// Writes art/raw/<name>.png (skips existing unless --force).
const fs = require('fs');
const path = require('path');
const specFile = process.argv[2];
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const force = process.argv.includes('--force');
const outDir = path.join(__dirname, '..', 'art', 'raw');
fs.mkdirSync(outDir, { recursive: true });
const specs = JSON.parse(fs.readFileSync(specFile, 'utf8')).filter(s => !only.length || only.includes(s.name));
const STYLE = 'retro 16-bit pixel art, limited palette';

async function gen(s) {
  const out = path.join(outDir, `${s.name}.png`);
  if (fs.existsSync(out) && !force) return `skip ${s.name}`;
  const body = {
    description: `${s.description}. ${s.style || STYLE}`,
    image_size: { width: s.w, height: s.h },
    no_background: !!s.nobg,
    text_guidance_scale: s.guidance || 8,
  };
  for (const k of ['outline', 'shading', 'detail', 'view', 'direction', 'seed']) if (s[k] != null) body[k] = s[k];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch('https://api.pixellab.ai/v1/generate-image-pixflux', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer proxy-injected' },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    if (r.ok) {
      const j = JSON.parse(txt);
      const b64 = (j.image && (j.image.base64 || j.image)) || '';
      fs.writeFileSync(out, Buffer.from(String(b64).replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      return `ok ${s.name} (${s.w}x${s.h}) cost=${JSON.stringify(j.usage || '')}`;
    }
    if (r.status >= 500 || r.status === 429) { await new Promise(res => setTimeout(res, 3000 * attempt)); continue; }
    return `FAIL ${s.name} ${r.status} ${txt.slice(0, 300)}`;
  }
  return `FAIL ${s.name} retries exhausted`;
}

(async () => {
  const queue = specs.slice();
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) console.log(await gen(queue.shift()));
  });
  await Promise.all(workers);
})();

// Pre-render voice lines with ElevenLabs (key injected by the environment proxy; never shipped).
// Usage: NODE_USE_ENV_PROXY=1 node tools/voices.js audio/specs/<file>.json [--force]
// Writes audio/<specname>/<key>.mp3 (22kHz 32kbps mono — small enough to embed).
const fs = require('fs');
const path = require('path');
const specPath = process.argv[2];
const force = process.argv.includes('--force');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.join(__dirname, '..', 'audio', path.basename(specPath, '.json'));
fs.mkdirSync(outDir, { recursive: true });
const entries = Object.entries(spec.lines);
const chars = entries.reduce((n, [, t]) => n + t.length, 0);
console.log(`${entries.length} lines, ${chars} characters`);

async function one([key, text]) {
  const out = path.join(outDir, `${key}.mp3`);
  if (fs.existsSync(out) && !force) return `skip ${key}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${spec.voice_id}?output_format=mp3_22050_32`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': 'proxy-injected', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: spec.model_id, voice_settings: spec.settings }),
    });
    if (r.ok) { const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(out, buf); return `ok ${key} ${buf.length}B`; }
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 2000 * attempt)); continue; }
    return `FAIL ${key} ${r.status} ${t.slice(0, 200)}`;
  }
  return `FAIL ${key} retries`;
}
(async () => {
  const q = entries.slice();
  await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) console.log(await one(q.shift())); }));
})();

# KREPLIN

A Southampton FC chairman sim. Standalone project — unrelated to the Krelworld games in this repo.

## Layout

- `original/KREPLIN.v12.html` — the untouched v12 single-file game (reference only).
- `src/` — the game split into ordered parts (`manifest.json` gives the order).
- `dist/KREPLIN.html` — the built single-file game. Open it in a browser.
- `tools/build.js` — `node tools/build.js` concatenates `src/` into `dist/`.
- `tools/autoplay.js` — headless smoke test: plays the built game with random choices at high speed and reports errors, stalls and progress.
  `node tools/autoplay.js --steps 3000 --seed 1 [--shots dir]`

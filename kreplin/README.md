# KREPLIN

A Southampton FC chairman sim. Standalone project — unrelated to the Krelworld games in this repo.

## Layout

- `original/KREPLIN.v12.html` — the untouched v12 single-file game (reference only).
- `src/` — the game split into ordered parts (`manifest.json` gives the order).
- `dist/KREPLIN.html` — the built single-file game. Open it in a browser.
- `tools/build.js` — `node tools/build.js` concatenates `src/` into `dist/`.
- `tools/autoplay.js` — headless smoke test: plays the built game with random choices at high speed and reports errors, stalls and progress.
  `node tools/autoplay.js --steps 3000 --seed 1 [--shots dir]`

## Publishing to the claude.ai artifact link
The artifact viewer blocks third-party media (Dropbox), so the artifact build serves every video/song/image
from the artifact's own asset store. Media were re-encoded (H.264 540p MP4, AAC audio in MP4, each <15MB)
and uploaded once; `tools/artifact-media-map.json` maps Dropbox file id -> asset id.
1. `node tools/build.js && node tools/build-artifact.js` -> `dist/KREPLIN.artifact.html`
2. Publish that file to https://claude.ai/artifact/4idE7ewo9XirEoTfXkGEjB (capability: assets).
New Dropbox media must be re-encoded, uploaded as an asset, and added to the map.

## Live web link (GitHub Pages)
https://playkrelworld.github.io/kreplin/ — the playkrelworld.github.io build workflow copies
`kreplin/site/index.html` from this branch into its Pages deploy (hourly and on every push to that repo's main).
Update it with: `node tools/build.js && node tools/build-site.js`, commit + push `site/index.html`;
it goes live on the next hourly rebuild (or re-run that repo's "Build Krelworld" workflow).
Media is served by jsDelivr from `site/media` (pinned commit), so new media must be added there and the pin updated.

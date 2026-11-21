# Chef Marina

A pixel-art sandbox game for Marina. Open `index.html` through any static web server (for example `python3 -m http.server`) and tap ▶️.

- `assets/atlas.png` / `atlas.json` hold the sprites, made with PixelLab.
- `assets/vo/` holds the voice lines, made with ElevenLabs. The file name prefix says who is speaking: `m_` Marina, `d_` Daddy, `mo_` Mommy, `r_` Uncle Rory, `tv_` the TV.
- `assets/sfx/` holds the sound effects, also made with ElevenLabs. The music is synthesized live in `audio.js`.
- Code: `engine.js` (rendering), `world.js` (rooms and data), `game.js` (gameplay), `ui.js` (panels and buttons).

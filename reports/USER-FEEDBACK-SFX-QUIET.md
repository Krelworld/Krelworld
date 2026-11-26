# UPDATE FROM THE USER (01:45 UTC), read this before going further

The user played the LIVE game again on their phone, verbatim: "Kay I just played again and the sound effects weee simply very quiet".

So the effects are NOT silent: they are far too quiet on a phone. Change of task:
1. Keep any real bug you already found (fix it as planned), but the main job is now LOUDNESS of effects on phones.
2. Wave 2's phone mix (branch s3-scenes, commit 4a07241c and after; src/game/mobile/mix.ts, mixLogic.ts; report
   reports/s3-08-sound.md) lifts effects only +3 to +5 dB over the dungeon song: gunshots over the song are heard at about
   -16.8 dBFS RMS against voice lines at -9.3. That is still too quiet for this user.
3. Make a branch "sfx-mix" from s3-scenes HEAD in a new worktree (git worktree add -b sfx-mix <SP>/sfx-mix-wt s3-scenes;
   cp -al node_modules; rm node_modules/.vite). Do NOT touch s3-scenes-wt or s3-games-wt (a review is running there).
   Tune the phone mix so that in a DUNGEON fight gunshots, hits, enemy deaths and explosions are clearly loud and punchy:
   heard RMS of gunshots over the dungeon song within about 3 dB of voice lines (about +8 to +10 dB over today's live phone,
   measured with s3-sound/measure.cjs), the dungeon song itself sitting a little lower under the fight on phones, the
   ceiling still under -1 dBFS with every slider at 100%, no pumping on the song, sliders still scaling exactly.
   Also check whether the Effects slider default and the game's Effects x0.6 factor are what makes them quiet, and whether
   specific dungeon sounds (gun shots, enemy hits, fart blaster) are much quieter files than others (normalise on phones only if so).
   Phones only: laptop identical. Small commits to mixLogic.ts / mix.ts so they merge cleanly into s3-games later.
4. Report the before/after table in ga-06-sfx.md and list the "sfx-mix" commits in your JSON (commits field).

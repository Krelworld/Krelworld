# Stage 3, wave 1: phone platform (sound, memory, frame rate, saves, caching, pause routes)

Branch `s3-perf` (worktree `scratchpad/s3-perf-wt`), on top of `37a710d4`. Everything new is in `src/game/mobile/`
(`art.ts`, `artLogic.ts`, `audio.ts`, `audioLogic.ts`, `perf.ts`, `perfLogic.ts`, `storage.ts`; small edits to
`index.ts`, `shell.ts`, `observe.ts`, `modes.ts`, `diag.ts`, README). One guarded hook outside it:
`KrelfordFinale.ts` (`setZoom(isMobile() ? 1 : 0.8)`, `zoomTo(isMobile() ? 1 : 0.8, 10)`, flag import). No dialogue,
story text, index.html, main.ts scene list, Phaser config, vite config or art file touched. No ALT-only difference.

## 1. Memory (the biggest win)

The laptop decodes all 2,450 pictures at boot (~920 MB). On a phone, `art.ts` "parks" the big one-scene pictures
(`artLogic.ts PARKED_ART`: TV faces/anchors/cast, boss anim/die/down sheets, krelact/krelvic, finisher cinemas kc/kca/kcf/kcv,
versus cards, every `*_still_*`, `*_cut_*`, `*_eyes_*`; 661 textures, ~608 MB) as the loader adds them: the texture keeps
its key, size and frames (so the game's code runs unchanged: `exists()`, frames, `getSourceImage().width` all as on a
laptop), the GPU holds a 1x1 blank, and the source is a 1x1 canvas that reports the real size. Anything that draws it,
asks for it (`textures.get/getFrame` after boot) or starts an animation on it fetches it back from the HTTP cache
(`img.decode()`, off the main thread) and uploads it into the same GL texture; a 5 s sweep re-parks what nothing has
used for 30 s and no game object holds. A lost WebGL context re-fetches live ones. Laptops: no change (phone chunk only).

Texture memory, iPhone 14 profile (`work/s3-perf/mem.cjs`):

| Where | Before | After |
|---|---|---|
| Boot / Enter gate / title / home | 917 MB | 309 MB |
| Hub | 938 | 330 |
| TV show (tcc_ep7, faces streamed in) | 938 | 332 |
| Polson Towers / Hoard boss | 918 | 310-314 |
| Concept boss (krelford_finale) | 953 | 352 |
| **Peak over the walk** | **953 MB** | **352 MB** (target < 500) |

Cost: a parked picture pops in 100-400 ms after it is first drawn (slowest seen 781 ms in emulation, TV face at show
start). Decoded sound stays ~120 MB (47 MB stereo); not cut (decode-on-demand would make first plays fall back to the
synth beep; mono downmix would lose stereo on phone speakers). Total phone peak ~470 MB.

## 2. Sound (`audio.ts`)

- The game's `new Audio(url)` (every song in Synth.playFile, every slowed/sped voice in Voice.ts) gets one of 5 pooled
  elements (3 song, 2 voice) that the first `touchend`/`click` started silently, so later songs (and rhythm songs:
  crocodile, Cam2Cam) start the moment the game asks, no extra tap. The game's listeners on a reused element are removed.
- Each pooled element goes through its own Web Audio gain node; the element's `volume` property is redirected to that
  gain (Music/Voice sliders, fades, dialogue duck work on iOS, which ignores element volume). Effects and ambience were
  already Web Audio. Self-test: 5 s of digital silence through the route switches later songs to plain elements, slider
  becomes on/off via `muted`.
- `navigator.audioSession.type = "playback"` from the first tap ("ambient" when Play over my music is on; now applied live).
- Resume: after the page is shown the context must run AND its clock must advance, else suspend+resume once more;
  every tap retries a non-running context (covers iOS "interrupted" after a call/Siri). Last resume reason kept.
- No double music: a playing song that is neither the current one nor fading is stopped; a song the pause menu holds
  stays held.
- `?mobilediag` lines: sound route, session, music/voice/loops playing, last resume (+ reason, age), doubles stopped.

Verified in Chromium emulation (smoke `platform`): route "web audio" after the first tap; music 0 → gain 0, 0.5 → 0.4
(master 0.8), element volume stays 1; hidden → suspended, no song; shown → running, "page shown", song plays, once;
crocodile song plays with no tap; a stray second song is stopped.
**Only a real iPhone can confirm:** the slider audibly changes the music; the silent first-tap unlock really lets later
`play()` calls through; the route is not silent (self-test); sound with the ringer switch off (audioSession, iOS 17+);
resume after lock / call / Siri / app switch; Bluetooth latency in the rhythm games; voices at 1.5x through the pool.

## 3. Frame rate (`perf.ts`)

- Off-screen culling: top-level world-space Images/Sprites wholly outside the camera view (+96 px) are skipped for that
  camera (concept boss: 148 skipped, 85 drawn per frame).
- Blood pools capped at 40 per fight (oldest hidden, not destroyed).
- Concept boss camera stays at zoom 1 on phones (was 0.8).
- A ring at the player's feet (concept boss's Krelford, dark rooms, screens with 220+ objects).

Measured, iPhone profile, 4x CPU throttle (`perf.cjs`, `abtest.cjs`): concept boss 6.4 fps before / 6.6 after; Hoard
14.2 / 12.0 (noise). A CPU profile shows 93% of the frame is native code (SwiftShader, the software GPU, which CPU
throttling does not slow); JS per frame is 19-22 ms at 4x either way. **Emulation cannot measure phone fps** for this
game; the honest claim is: fewer draw submissions, fewer pixels in view, fewer textures resident. A real-device
`?mobilediag` reading (fps, "drawn / skipped off-screen") is needed. The audit's other items (skip postFX glow, half rain,
flat 3D shots, corpse caps) were not done: the concept room has no postFX in use; the rest belongs with real readings.

## 4. Saves and caching (`storage.ts`)

- The game already autosaves constantly (every room, every scene change) and the shell saves on hide/pagehide. Added: a
  save on Chrome's `freeze`, and `navigator.storage.persist()` asked once per launch, silently (never in Firefox, which
  would show a permission box). Nothing is shown to the player. Diag: "saves kept by the browser: yes / not promised",
  storage usage.
- Caching: measured with GitHub Pages' headers (max-age=600, ETag) and a disk-backed Chromium profile: first visit
  103 MB of art from the network, reload **0 MB** (2,471 files from cache), a parked picture fetched back from the cache.
  (A Playwright incognito context's small memory cache re-downloads everything: a test artefact.) **No service worker**:
  the HTTP cache already does the job, the SW file would have to live in `public/` (outside the phone folder), and a
  worker serving stale code/art after a deploy is hard to remove from friends' phones. A touch laptop opening `?mobile=1`
  would also have registered it.
- Not done: save export/import code (S7); the in-app warning before a save is started exists from stage 1.

## 5. Pause routes

`PauseRoute` is now `"edge" | "menu" | "card"`. Minigame, Whack, Drive, BeepBeep (`MINIGAME_PAUSE`): II + the game's
pause menu (holds the song and the scene clock). Finale between brawl rounds: now tap mode (was "brawl" with a legacy pad
the finale never had outside the brawl) with II + the shell's PAUSED card; the card now holds the song too (also for the
brawl's own II). Coming back after a lock opens these pauses (`wakeCare` → "pause"), not the carry-on card. Generic for
wave 2: add `pause: "menu" | "card", pauseButton: true` to a rule; `setCardPause()` connects the card route.
The II in tap mode sits in the top-right pause slot and may overlap a minigame's own corner UI: wave 2's layouts own that.

## 6. In-app browsers (P7 remainder)

In an app's own browser the boot's download is held (`maxParallelDownloads = 0`) behind the "open it in Safari / Chrome
first" card until PLAY HERE ANYWAY (then it loads). (The loop already sleeping under the card stalled it; now explicit.)

## Tests and checks

- `tests/mobilePlatform.test.ts` (9): parkable set, park rule, audio kind, session type, volume plan, silent-route
  rule, off-view, marker rule, pool cap. `tests/mobileModes.test.ts` updated for the new pause routes.
- `scripts/mobile-smoke.cjs --only platform` (25 checks): sound route and Music setting, hidden/shown resume, no-tap rhythm
  song, one song at a time, diag lines, texture peak < 500 MB over home/hub/TV/Hoard/concept (boot < 400), TV faces come
  back, parked size kept, concept zoom 1 + ring + culling, minigame II → pause menu and wake → pause menu, finale II →
  card with song held, carry on, wake → card, in-app hold and PLAY HERE ANYWAY.
- Full check: see the end of this file.

## Judged against "mega intuitive and fun"

A player never sees any of this, which is the point: songs start when they should and the volume slider works on an
iPhone, the game should no longer be killed for memory mid-dungeon, coming back from a call shows a pause, and every
minigame has a II. Still not good: pictures pop in a few hundred ms late the first time a TV show or a boss appears;
fps on a real phone is unmeasured.

## Full check (end of work, commit 18ba288c)

- (a) Laptop fingerprint: `shell,front,newgame,hub,meeting,dungeon` 40/40 identical, `boss,side,places,minigames,finale,alt`
  25/25 identical: DESKTOP FINGERPRINT: OK both halves.
- (b) touchlaptop, ipad, fire7 (front,newgame) and androidtab (front,newgame,hub): all OK.
- (c) `tests/desktopInvariants.test.ts` passes; it, `tests/fingerprints/` and index.html unedited.
- (d) `npx tsc --noEmit` clean; `npx vitest run` 45 files, 560 tests pass.
- (e) Phone smoke, main: 438/443; ALT: 437/443 (platform section 25/25 in both after the test fix). The other failures
  were timing checks under a load average of 13 on 4 CPUs (another agent running) and differ run to run:
  - main: auto-fire kill, HEAL drink, boss name vs KREZZ lines x2 → `--only combat,together` re-run on this branch:
    67/67, and 67/67 on the baseline 37a710d4.
  - ALT: R9 hidden mid-fight, bongo chip, SANMIK chip, READY GOLD, coyote, P2 pit → re-run `combat,side,review1`: only
    SWAP tap, auto-fire on the boss (both different from the first run, i.e. flaky) and P2 failed. **P2 fails on the
    baseline 37a710d4 ALT build too** (`--only review1`: falls 3): pre-existing, not from this branch (side.ts / the
    feel branch's area).
  - main platform: one page error, from the smoke's own stray-song `play()` promise; fixed in the test (18ba288c).

## Lists the task asked for

- Hooks outside `src/game/mobile/`: `src/game/scenes/finale/KrelfordFinale.ts` (two zoom ternaries + flag import).
- Narrator tips swapped: none. Character lines mentioning a key: none touched. No dialogue changed.

## Deviations from the research

- M12 sound memory (decode effects on first use, mono) not done: ~120 MB decoded stays; first plays would fall back to the
  synth beep. TV art is not loaded "when the TV opens" but on first draw (finer: only the show's own cast).
- M9 "one reused element": three song elements (the game cross-fades two), two voice elements.
- S14 service worker: not built (reasons above); S7 save export/import: not built.
- Reload-loop guard / low-memory mode (M12): not built; the parked art should make it unnecessary, a real iPhone will tell.

## Only a real iPhone can confirm

Audible slider changes; first-tap unlock of pooled elements; route not silent; ringer switch with audioSession; resume
after lock / call / Siri / app switch; real fps in the concept boss and Hub (`?mobilediag`: fps, drawn / skipped);
no tab reload over ten minutes (memory); pop-in time of parked pictures on cellular; `storage.persist()` answer.

# s4-03: platform and robustness QA (read-only)

Branch `s4` at 8b337a45, in a throwaway worktree (now removed). Dev servers: main on :5841, ALT on :5851.

Profiles:
- iPhone 14: 844x390, DPR 3, mobile Safari UA, insets 47/47/21 through `setInsets`.
- Android Chrome: 740x360, DPR 2.
- Other sizes: 750x340 and 740x360 for the load list; 390x844 for portrait.

All input was real CDP touch. Android Back was the browser's own back (`page.goBack()`), on a page opened after another page in the same tab, the way a link from a chat opens.

Machine load during the runs was 2.5 to 7.

- Scripts and logs: `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/work/s4qa-platform/`. The scripts are lifecycle, back, saves, memory, sound, standalone, games, bike, loop and idle `.cjs`, plus the smoke logs.
- Screenshots: `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s4qa-platform/`.

## Findings

### F1 MAJOR: Android Back twice leaves the game (DEFERRED R3, reproduces every time)
- **What the player sees.** In town, in a fight or in a minigame, the first Back opens the pause menu. A second Back with no tap in between leaves KRELWORLD and goes to the previous page. Coming back means a full reload (15 to 60 s). Progress is kept, because the save on `pagehide` works.
- **Repro.** Android Chrome 740x360. Open the game after another page. Then either walk in town, or go to Wildern room 1 through DebugSkip, or the crocodile minigame. Press Back, then Back.
- **Results.** Town 1 run of 1, fight 1 of 1, minigame 1 of 1: the URL became the previous page (`back.cjs`, `back-town-1.png`).
- **What stays on the page.** The title, a town conversation (Back 3 times), the TV, the Phone settings page and the guide (Back closes those two). Back, RESUME by tap, Back gives the pause menu again.
- **Why.** `shell.ts onBack()`: "a back while the pause menu is showing leaves the game" (`history.back()`). This is the design, but players double-swipe. Android's edge-swipe Back also starts at the screen edge where the stick zone begins (x = 0).
- **Untested risk, needs a real device.** iPhone Safari's left-edge swipe is also a history back (in a tab, not from the home screen). A stick drag that starts at the very left edge could pause the game, and a second one could leave it.
- **Suggested fix.** Back on the pause menu should close the menu (RESUME). Or it should show a "Leave KRELWORLD?" card, and only that card's YES (or a third Back) leaves.
- **Laptop.** No (phone shell only).

### F2 MAJOR (known P9, confirmed): the Wonk-Off starts under the conversation taps and has no II
- **Repro.** iPhone 14, the Club, `wonkOff()`, then tap through the lines as a player would.
- **What happens.** The game started straight after the last line. My taps fell into it, and it was over within about 3 s (lost). The II showed only in a 0.65 s gap (`walk:Club`). Before and after it the layer was `none:Club` with no II.
- **Evidence.** `games.cjs`, `p9-wonkoff.png`. s4-02 (F-list, "Known P9") saw the same.
- **Laptop.** No.

### F3 MINOR (known P7, reproduces): the Krunch Pit board's first row overflows
- **What the player sees.** With Bigger text on (the phone default), at 844x390, the ENDLESS GAUNTLET description runs two lines. Its second line ("banks · 25 + kill drops") sits under the REMATCHES row.
- **Also.** The opening narration box covers the lower part of the board.
- **Screenshot.** `p7-pit-board.png`.
- **Laptop.** No.

### F4 MINOR (known P6, mostly fixed): Whack-a-Drongus card
- **What is fixed.** No text off the picture and no text on other text (measured).
- **What remains.** The rules line under the panel wraps, leaving "KREZZCOIN" alone on a second line just above "INSERT 100 KREZZCOIN". It reads as a stray word.
- **Screenshot.** `p6-whack-card.png`.

### F5 MINOR: the pause menu's FULLSCREEN row misleads in a home-screen app
- **iPhone from the home screen** (`navigator.standalone`; the element fullscreen API is removed, as on an iPhone). The guide is correctly gone: no auto-show, no title button, no pause row, no rotate-screen button. In its place the pause menu shows "⛶ FULLSCREEN". Tapping it shows the toast "FULLSCREEN ON iPHONE · Tap Share then Add to Home Screen". The player is already there, and the game is already full screen (`standalone-iPhone-ios-fullscreen-row.png`).
- **Android installed app, `display: fullscreen`** (the manifest's mode; simulated with a `matchMedia` stub, because this Chromium does not emulate display-mode). The row reads "⛶ FULLSCREEN". A tap enters element fullscreen, and the row then turns into "📲 ADD TO HOME SCREEN". The cause is in `platform.ts`: it counts display-mode fullscreen as "installed" only while no element is fullscreen (`standalone-Android-fullscreen-fullscreen-row.png`).
- **Suggestion.** On a phone running from the home screen, hide the row.
- **Laptop.** No.

### F6 MINOR (all versions, bike): a Kreddle local's shove does not get you off the bike
- **Repro.** iPhone 14, Kreddle, tap RIDE (you are riding), then a local's `shove()`.
- **Result.** `riding` stays true (`bike-kreddle-after-shove.png`).
- **Cause.** `KreddleScene.shove()` has no `bike.dismount`, although `bikeControl()`'s comment says a shove gets you off.
- **Laptop.** Yes, it is the same on a laptop. It is the bike's own nit, so ordinary game code is allowed for the fix.

### F7 MINOR (all versions, bike): in town the bike is drawn one frame behind the rider
- **Measured at draw time.** The bike's back layer is −12.3 to −12.5 px from the rider's feet while riding right, and −18.9 px on a slow frame (92 frames). In Kreddle it is 0 px.
- **Cause.** In Kreddle the rider is moved by hand before `bike.update`. The Hub's `av` is an Arcade sprite, and physics moves it after the scene's `update`, where `bike.update` runs.
- **Suggested fix.** Place the layers on the scene's POST_UPDATE.
- **Laptop.** Yes, all versions (bike).

### F8 MINOR: iOS 16 (no `navigator.audioSession`): no fallback for sound with the ringer switch off (open item, still open)
- **Simulated** by deleting `navigator.audioSession` before boot. The game boots, routes through Web Audio and plays. `audio.diag().session` is "n/a". Nothing else asks iOS for a playback session: `audio.ts applySession()` returns when it is missing, and there is no silent looping element.
- **iOS 17 simulation.** A stub `audioSession` gets "playback", and "ambient" with Play over my music.
- **Not checked on a device.** Effects may be silent on an iPhone 16-era phone with the ringer switch off. They may still be heard while a song element is playing.
- **Suggestion.** Only when `audioSession` is missing on iOS, start one silent looping plain `<audio>` element on the first tap. Hold it with the `hidden` hold.

### F9 MINOR: the SAVE GAME list's BACK button sits over SLOT 3
- **Where.** 844x390, pause menu, SAVE GAME.
- **What happens.** "◀ BACK" covers the lower middle of the SLOT 3 row. A thumb on the lower half of SLOT 3 presses BACK (`saves-save-list.png`, `saves-load-list-750x340.png`).
- **Laptop.** The layout is the same on a laptop, but a mouse is precise; phone-only relayout is fine.

### F10 MINOR: Android Back during a TV show does nothing
- **What happens.** Back neither switches the TV off nor pauses (`back-tv-1.png`).
- **Expected.** On Android, Back is "get me out of here". SWITCH OFF is on screen, so mapping Back to it would be natural.

### F11 MINOR (test, not the game): the smoke's "Firing LIGHT" pace check is meaningless and should be retired
- **Results.** It failed 2 runs of 2: AUTO 3 shots against LIGHT 1, then AUTO 0 against LIGHT 2.
- **Why.** The window counts 0 to 3 shots, so the ratio is noise. LIGHT is no longer offered in Settings.
- **The other LIGHT check passed** ("holding FIRE fires at the full pace").
- **Suggestion.** Retire the pace check, with the reason that LIGHT is not reachable by a player. If the rule is kept, check it in a unit test of the firing-style logic.

### F12 MINOR (flaky check, the number is on the edge): review1 P2 pit put-back distance
- **Results.** 1 fail in 2 runs at load about 3.
- **Measured.** The player is put back 98 px short of the edge, then 109 px. The check needs at least 100 px, and its label promises "at least 120 px".
- **Cause.** This is the game's real respawn spot sitting on the threshold, not test timing.
- **Suggestion.** Put the player back further (about 140 px), which matches the label, rather than loosen the check.

## The known open items, one by one

| Item | Reproduces? | Evidence |
|---|---|---|
| P6 Whack card | Mostly fixed. One stray wrapped word is left (F4) | `p6-whack-card.png`, `games.cjs` |
| P7 Krunch Pit board | Yes (F3) | `p7-pit-board.png` |
| P9 Wonk-Off | Yes (F2) | `games.cjs`, s4-02 |
| P11 load rows under the 🗑 | No. Measured no text under any 🗑 at 844x390, 740x360 and 750x340 (main and ALT). The objective line is cut at the button, mid-word | `saves-load-list-*.png` |
| P12 Beep Beep BOOST/BRAKE over MPH | Not re-measured: my run never reached driving, and only the II was up. s4-02 F9 confirmed it at 740x360 | `p12-beepbeep.png` (intro) |
| Firing LIGHT smoke checks | Fail; a test to retire (F11) | `smoke-csr-1.log`, `smoke-csr-2.log` |
| Flaky P2 pit | 1 of 2 runs; the game's number is on the edge (F12) | the same logs |
| Flaky side coyote | Passed 2 runs of 2 (load about 3) | the same logs |
| Flaky SWAP / chip tap | Passed 2 runs of 2 | the same logs |
| Flaky HEAL tap | Passed 2 runs of 2 | the same logs |
| R3 Back twice in town | Yes (F1) | `back.cjs` |
| TV-from-Hub memory spike | No (details below) | `memory.cjs` |
| Bike: Kreddle shove | Yes (F6) | `bike.cjs` |
| Bike: layers trail by a frame | Yes in town, no in Kreddle (F7) | `bike.cjs` |
| Bike: button flicker on a hitch | No (details below) | `bike.cjs` |
| iOS 16 sound on silent | Still open (F8) | `sound.cjs` |

Details for three rows:
- **TV-from-Hub spike.** Peak renderer 771 to 806 MB in every path, over 4 runs: Home's telly, the Hub's own `openTV` path, and the old smoke path (`scene.start("TV")` over a running Hub, even over a town conversation). That is the same as TV from Home. The TV was active within 15 s each time, with no crash.
- **SWAP tap.** g1 = null is the Fart Blaster, the next gun after the pistol, so the check is not vacuous.
- **Bike button flicker.** Five 400 ms main-thread stalls in town while riding: the WALK control stayed shown in all 39 samples.

## Memory (iPhone 14 profile, main): the 25-stop walk

The full table is in `work/s4qa-platform/memory-phone.json`. Textures are what the phone keeps; parked pictures count nothing. Renderer and GPU are process RSS in headless software GL.

| Stop | Textures MB | JS heap MB | Renderer MB | GPU MB | Art parked / live |
|---|---|---|---|---|---|
| Title | 309 | 46 | 629 | 632 | 661 / 0 |
| Home → TV from Home → Home | 309 → 311 | 43-54 | 641 → 700 (peak 771) | 651 | 656 / 5 |
| Town → TV from the Hub → town | 331-332 | 49-53 | 791 (peak 793) | 753 | 656 / 5 |
| Kreddle, the Pub, the Club | 309-312 | 50-57 | 809-830 | 744 | 661 / 0 |
| Wildern, Polson Towers, the SanMik side room | 310-312 | 55-63 | 874-906 | 793-798 | 660 / 1 |
| Krandall boss | 314 | 52 | 959 | 810 | 654 / 7 |
| The concept boss (Krelford finale) | **350** (peak) | 61 | 958 | 836 | 656 / 5 |
| Finale, crocodile, Whack, Beep Beep | 316-324 | 57-62 | 949-980 | 806-813 | about 653 / 8 |
| Home, town again, then after the 30 s sweep | 322-333 | 64-68 | 979-994 | 815-842 | 661 / 0 |

- **No art load failed.** 31 pictures were fetched back. The second boss (Flirt, `crobley_factory` 3) was not reached: DebugSkip's path ended at Home after 99 s. That is a debug path only, and I did not chase it.
- **Idle on the title for 5 minutes.** Flat (608 to 614 MB) once the offline copy finished, after 60 s.
- **The same 5-scene lap 4 times.** Heap 48 to 50 MB and textures flat. The game makes about 6 new 1x1 Phaser canvas textures per lap (big ones are replaced, not kept): negligible.
- **Renderer RSS is noisy.** It went 798, 823, 837, 850 MB in one run and 804, 1375, 1383 MB in another. Headless software GL cannot settle whether it is a real slow creep.
- **Suggestion.** Watch `?mobilediag` on a real iPhone over a long session.

## Lifecycle (iPhone 14, main; town and fights also on ALT)

All of these passed:
- **Town.** Hidden in the middle of a stick press, by `visibilitychange` and by `pagehide` / `pageshow(persisted)`:
  - the stick lets go;
  - the loop sleeps and the sound context is suspended;
  - the AUTO slot is rewritten;
  - when shown again the game carries straight on, with one song and nothing held.
- **Town, portrait and back.** Portrait gives the rotate screen and sleeps; back in landscape the canvas is the full 390 px high and the controls are in place.
- **A conversation.** Hidden, then portrait: the same line stays on screen, and taps finish it.
- **The TV.** It sleeps when hidden or in portrait and carries on afterwards.
- **A fight.** Hidden, pagehide or portrait while holding the stick and FIRE: everything lets go. Coming back always opens the pause menu, with nothing held after RESUME. The player drifted 1 to 7 px after RESUME with TOUCH at 0; that is the room's enemies, not input.
- **A minigame.** Hidden or portrait: back opens the pause menu with the song held.
- **No page errors** anywhere.

## Saves (iPhone 14; main and ALT pass)

All of these passed:
- SAVE GAME to slot 1 and slot 2 by tap, from the pause menu.
- An autosave, then a change saved only by the save on hide, then a reload: CONTINUE offers it, and AUTO holds the hidden-save's coins.
- LOAD GAME lists AUTO, 1 and 2.
- Slot 1's 🗑 asks first (it does not load), and DELETE by tap empties slot 1.
- A tap on slot 2 loads it, with its coins, in town.

## Sound (iPhone 14)

All of these passed:
- The route is Web Audio and the context runs after the first tap.
- The session is "playback", and "ambient" with Play over my music.
- In town and in a fight the II holds the song (`currentTime` frozen), and RESUME plays one song.
- The fight mix is on in a dungeon; guns are heard over the dungeon song, peaking at 0.783 (under -1 dBFS).
- Never two songs at once: sampled every 250 ms over 9 scene changes, a fight and a minigame, the worst overlap was 3 samples (inside the 1.2 s fade grace).

## The guide, `?mobilediag`, in-app browsers, home screen

- **Smoke `guide,android` on main:** 52 of 52 passed.
- **In-app browsers.** Instagram (iPhone), Facebook (Android) and Messenger (iPhone, upright): the "open in Safari / Chrome first" card shows during the load and fits with no scroll. It has COPY LINK and PLAY HERE ANYWAY, and the latter loads to the Enter gate.
- **`?mobilediag`** on both phones: it shows the home-screen state, the sound route, memory and storage, and the II still works with it up.
- **From the home screen** (iPhone standalone; Android standalone and fullscreen): the guide never shows itself, and there is no title button, pause row or rotate-screen button for it. The only issue is F5.

## What works well (keep it)

- The shell's holds: hidden, portrait and the guide, plus `wakeCare`, which sends fights and minigames to the pause menu.
- The save on hide.
- Back handling everywhere except the pause menu.
- The art parking: textures stay flat at about 310 to 350 MB, against about 920 on a laptop.
- The one-song rule.
- The phone mix.
- The in-app card and the guide variants.
- The load list's layout (P11 is fixed).

## Laptop

Nothing here changes the laptop. F6 and F7 are the bike's own nits and are present on a laptop too. All other findings are phone-only code or phone-only layout.

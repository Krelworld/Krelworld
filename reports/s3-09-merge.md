# Stage 3, wave 2: merge (s3-games + s3-scenes + s3-tap + mobile)

Worktree `scratchpad/s3-games-wt`, branch `s3-games`. Nothing pushed.

## Merges

1. `git merge s3-scenes` → 9dc1b05b. Conflicts, all "keep both":
   - `src/game/mobile/boot.ts` `PhoneHooks`: the minigames' `rhythmLag?()`, plus Night of Freedom's `gunAim?()` and
     Beep Beep's `wheelTouch?()`.
   - `scripts/mobile-smoke.cjs`: the `games` and `scenes` sections side by side. Each section closes its own browser
     context. Both are in the default `--only` list and the run list.
   - `src/game/mobile/README.md`: both sections ("Minigames by touch" and "the special scenes" + the sound mix) and
     the smoke command line.
   - `index.ts` auto-merged: `installGames` before `installScenes`, so the games' wording rows go in first and the
     scenes' mode rows sit in front of stage 1's `minigames` row.
   - Checked for overlap: games handles only Minigame and Whack, scenes only Drive / BeepBeep / TV / Tutorial / Lair,
     and each adds its own touch buttons only in its own scenes. Both hook-setting calls (`setPhoneHooks`) keep what
     was already set.
2. `git merge s3-tap` (wave 1's review fixes, b410b140) → 112b461e.
   - Smoke: `tapfix` and `mix3` next to `games` and `scenes`.
   - README command line updated.
   - `touchLayer.ts`: one comment conflict. Wave 1 (fix round P3) and the thumb-feel round had made the same fix to
     where the idle stick ring rests; one comment kept. The pass-through for taps beside ACTION's face merged cleanly.
3. `git merge mobile` (0da900db, the iPhone Add to Home Screen steps) → 71c14752, clean.

## Fixes made in the merge (phones only)

- **The cannon's how-to line** (5f94fb52).
  - Both tracks reword this UI line; the minigames' rule now runs first ("Tap: ANGLE, then POWER...").
  - The scenes' fix then never matched, so the line's dark backing pill stayed sized for the laptop's longer
    "SPACE / TAP:" line.
  - The scenes' fix now matches either wording and always refits the pill.
  - The smoke check accepts TAP or Tap (never SPACE) and checks the pill width.
  - The words are a UI tip, not dialogue; no character line touched.
- **?mobilediag's MOVE tab** (8ab9690f).
  - The sound mix added a read-out line. At 844x390 the box became 335 px tall from y 64, and the tab sat at y 399,
    off the screen. The sound track's own full run had not covered this section; the merged smoke failed on both builds.
  - The tab now sits beside the box's top in the corner under pause.
  - The text is capped so box plus tab fit in every corner (the last line or two clip at 740x360 and 750x340).
  - The font is a touch tighter (10px/1.25), so the whole read-out fits on an iPhone 14.
  - Measured all four corners at 844x390, 740x360 and 750x340: tab on screen and tappable, the box still starts in
    the right half.

## Integration checks: new smoke section `wave2` (iPhone 14, insets 47/47/21), 14 of 14

- **Tap to use into a minigame.** At Home, a tap on the games console walks there and opens KREZZSTATION 2; a tap on
  BULLY MIKEY starts the minigame. The layer is `tap:Minigame` with `game: "bully"`, `pause: "menu"` and the II. Two
  thumbs move its HITS count (0 → 16).
- **Paused on lock.** The page hidden mid-game: the loop sleeps. Back again, the minigame is paused under its pause menu
  (`Menu`, `lastWake: "pause"`); RESUME by touch carries it on. After the win it ends back at Home.
- **Sound mix.**
  - In the minigame: built, post gains music 0.34 / sfx 0.704 / voice 0.92, the game's master connection redirected,
    peak around -15 dBFS.
  - In a TV show (tcc_ep7): the show's voice lines go through it (voice redirections count up); peak -1.8 dBFS, under
    the -1.1 dBFS ceiling line.
- **Fight unchanged.** The pocket buttons 💨 🍺 are 60 px and HEAL 56 px, all on the right. The stick's base stays
  where the thumb landed after a 200 px drag, at full speed.
- No page errors.

(Test detail: a tap that lands after the minigame has faded out lands in Home, where tap to use walks to whatever is
under it. The section waits for the fade and never taps then.)

## The full check

| Check | Result |
|---|---|
| (a) laptop, half 1 (shell, front, newgame, hub, meeting, dungeon) | 40 of 40 identical, DESKTOP FINGERPRINT: OK |
| (a) laptop, half 2 (boss, side, places, minigames, finale, alt) | 25 of 25 identical, DESKTOP FINGERPRINT: OK |
| (b) touchlaptop / ipad / fire7 (front, newgame) | 16 / 16 / 16 identical, OK |
| (b) androidtab (front, newgame, hub) | 29 identical, OK |
| (c) desktopInvariants | 19 passed; the test file, tests/fingerprints/ and index.html unedited (also main.ts) |
| (d) tsc / vitest | clean / 49 files, 622 tests passed |
| (e) phone smoke, normal (5502) | full run 521 of 530; reruns below |
| (e) phone smoke, ALT (5512) | full run 602 of 610; reruns below |
| after the two late fixes (phone chunk only) | laptop shell, front, newgame on both builds 17 of 17 identical (OK); tsc clean; vitest 622 passed |

Game files outside `src/game/mobile/` changed in this wave are guarded phone hooks only:
- `BeepBeepScene.ts` (`wheelTouch`), `DriveScene.ts` (`gunAim`) and `MinigameScene.ts` (`rhythmLag`)
- `minigame/runescape.ts` (`phoneRs` when `isMobile()`)
- `systems/squeeze.ts` (`phone ?` radius, label and tap target)

The merge itself added none.

### Smoke failures: rerun and accounted for (load average 16 to 31 on 4 CPUs while the runs went on)

Fixed in this merge:
- the cannon's pill (scenes), now passes on ALT
- ?mobilediag MOVE, now passes on main (`guide` rerun) and on ALT (`guide` rerun)

Passed on rerun (load timing):
- `phone`: the welcome conversation. Under load the walk began before the check; the two Back presses then left the
  page, so the section stopped.
- main: auto-fire off, coyote, `mix3`
- ALT: coyote, the camera's turn speed, the Krezz Arms door (`tapuse`)

Pre-existing and flaky, not from this merge (each also fails in earlier branch runs, including the unmerged bases):
- **"weapon chip tap: the next gun"** and **"SWAP tap: the next gun"**: the test's 90 ms tap reads as a hold under
  load (both fail in s3-scenes base-combat, s3-review-laptop base, autofire, game-adds).
- **review1 P2** (a pit with the stick held toward it, 4 or 5 falls): fails in s3-games, s3-perf, s3-scenes main and
  the s3-review-laptop base run.
- **brawl "a tap on PUNCH"** (ALT, twice): reproduced on the merged ALT by hand. The first PUNCH punches, the second
  too; a third tap 0.5 s later can be refused by the fight's own state (the same on s3-scenes ALT). The phone layer
  delivers the press every time (`held: ["punch"]`). The smoke check takes one tap at whatever moment the fight is in.

Pre-existing crash, for the coordinator / stage 4:
- **`platform` on main: the page's renderer crashes (or the TV never starts) a few seconds into a TV show started
  from the town**, three runs in three (ALT passed). Reproduced alone with
  `scratchpad/mobile/work/s3-merge-w2/tvrepro.cjs` (title, Home, Hub, then `scene.start("TV", tcc_ep7)`):
  - TV takes 37 to 117 s to become active, then "Target crashed", after GPU-stall ReadPixels warnings
  - the same on s3-scenes alone (5542) and on wave 1's s3-tap (5307, no wave 2 code)
  - not caused by this merge. Most likely texture or GPU memory at 3x scale in headless Chromium. Worth a look on a
    real iPhone in stage 4 (Home, town, then a TV show).
  - the same TV show started from Home (`mix3`, `wave2`) runs fine.

## Dialogue

No dialogue or story text changed in the merge. The only text touched is the cannon's how-to tip (a UI line, already
touch-worded by both tracks on phones; the laptop line is unchanged).

# Stage 3, wave 1: merge (s3-tap + s3-perf)

Worktree `scratchpad/s3-tap-wt`, branch `s3-tap`. Nothing pushed.

## Merges

1. `git merge mobile`: already up to date (`mobile` still at 37a710d4; the mobile-feel fixes are not in it yet).
2. `git merge s3-perf` → 45903eb5. Three textual conflicts, all "keep both":
   - `src/game/mobile/index.ts`: imports (tap to use's `TapUse` and the platform's `PhoneArt / PhoneAudio / PhonePerf /
     storage`). The rest (art/perf first in `installMobile`, audio, card pause, in-app hold, diag, `__krelMobile`) merged
     cleanly next to tap to use's install.
   - `scripts/mobile-smoke.cjs`: the default `--only` list has both `platform` and `tapuse`.
   - `src/game/mobile/README.md`: the file table has both tracks' rows; the smoke command line lists both sections.
   - `observe.ts` (tap to use's `promptTarget` fallback, the platform's `setCardPause`) and `touchLayer.ts` auto-merged.
3. c2d250cd: a new smoke section `mix3` (both tracks at once, below) + README line.

Hooks outside `src/game/mobile/` after the merge: only s3-perf's `KrelfordFinale.ts` zoom ternaries (+ flag import).
index.html, main.ts, the Phaser / vite config, `tests/desktopInvariants.test.ts`, `tests/fingerprints/`: unedited.
No dialogue or story text touched; no narrator tip swapped in the merge.

## Integration checks (iPhone 14 profile, insets 47/47/21): `--only mix3`, 18 of 18

- Memory with tap to use: a TV show's faces come in, are parked again by the sweep once nothing uses them (texture
  memory back to 309 MB); back in Home, a tap on the telly from the far side walks there and opens KrelTV; every tappable
  thing in Home keeps its real picture size; the parked faces are fetched back (real pictures, none failed).
- Sound: the page hidden mid tapped walk → the walk stops ("release"), the stick numbers are let go (TOUCH.mx/my 0),
  the sound context suspends with no song; shown again → context running ("page shown"), the same number of songs as
  before (1), the player stands still; a new tap walks again.
- Pause: the II mid walk (Home's route "edge") opens the pause menu and the walk stops ("mode"); closing it leaves the
  player standing in walk mode. (Minigame "menu" and finale "card" routes: the `platform` section.)
- The stick (current default, floating in the left zone) stops a routed walk in the town at once ("stick"); the
  off-screen skip runs in the town at the same time (122 skipped, 66 drawn).
- Checked by reading: the frame-rate culling works through `willRender`, never `visible`, so tap to use's target readers
  (which skip invisible objects) are unaffected; tap to use's readers ask for no parked texture keys.

## Full check (on c2d250cd, own servers 5302 / 5312, stopped after)

RESULTS_TABLE

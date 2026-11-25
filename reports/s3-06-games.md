# Stage 3 wave 2, track A: minigames by touch

Branch `s3-games` (worktree `scratchpad/s3-games-wt`), from 68584994. Nothing pushed. New: `src/game/mobile/games.ts`,
`src/game/mobile/gamesLogic.ts`, `tests/mobileGames.test.ts`, the smoke section `games`. Small edits: `index.ts` (install,
`__krelMobile.games`), `settings.ts` (Rhythm sync live), `boot.ts` (one optional hook type), README, the wording scan test.
Guarded hooks in game files: `MinigameScene.ts` (2 lines + imports), `minigame/runescape.ts` (one `if (isMobile())`
block), `systems/squeeze.ts` (4 ternaries / branches). No dialogue, story text, index.html, main.ts scene list, Phaser
config, `tests/desktopInvariants.test.ts` or `tests/fingerprints/` touched. No ALT-only difference (storage via `storageKey`).

## 1. The map (what a phone had, from the code and 844x390 screenshots with the 47/47/21 insets)

| Scene / mode | How entered | Input it reads | Phone before | Required? |
|---|---|---|---|---|
| Minigame `bully` | the Booth (Hub), console | pointerdown anywhere / SPACE / E | worked; line "Tap / SPACE" | optional activity |
| `deadlift` | Krezwonk's arc, Jenko's "stacy" step | the same mash | worked; "Mash Tap / SPACE" | yes |
| `girlfriends` | arc | tap a phone / 1 2 3 | worked; "[1] [2] [3]" captions | yes |
| `renovate` (Flip It) | Scrombus's arc | tap a problem (40 x 30 CSS px) / arrows + SPACE | targets too small; keys in the line | yes |
| `runescape` | 4 characters' arcs | tap tree / ring / chest / inventory, SPACE, D, G, B, Esc | 33 of 41 targets under 40 px; Drop all / Re-up / Log out in the home strip | yes |
| `burpees` | arc | tap anywhere (= SPACE) or ▼ / ▲ corners | worked; keys line | yes |
| `facebook` / `modulator` | arcs | tap a row / 1 2 3 | worked; "[n]" prefixes | yes |
| `crocodile` | the dance step (ch 5) | 3 pads 181 x 39 CSS px / arrows, A D W SPACE | pads in the home strip; LEAVE under the II | yes |
| `cannon` | the hijack step | tap anywhere | worked; "SPACE / TAP" | yes |
| `gig` / gigWatch | Krebon's optional arc, the Krezz Arms card | hold / drag / tap Benn / A D SPACE F | worked; keys line; END GIG / LEAVE GIG under the II | optional (safe cut) |
| Cam2Cam acapella | – | – | removed from the game before this stage (21b30b84) | – |
| Golden juice squeeze (`systems/squeeze.ts`) | Hub women, the Club, Mollor's room | the 35 px circle (any tap = right) / E F R SPACE | small circle that says E / F / R / SPACE | yes (ch 3) |
| Club wonk-off, ClubCloseup | the Club | tap (already `TOUCH.enabled`-aware); close-up: tap skips | UP CLOSE 36 x 29 px; "ESC / CLICK: skip" | wonk-off in story |
| KrelCueScene | a Kreltality mid-script | stage 2's finisher buttons; the cinema skips on a tap | fine | – |
| Polson: bulking / turnstile (VignetteScene), PolsonHomeScene | ch 2 story | tap anywhere | worked; "Tap / SPACE" lines | yes |
| Other vignette mashes (lamp, jets, gauge), plane steering, parachute | story | tap / drag | worked; keys in the lines | yes |
| Kreddle Pit / PitLoan | Hub door, after ch 1 | card menu (stage 2 lists) | card line "▶ any key · A · tap" | optional ("none of it counts") |
| Whack-a-Drongus | Kreddle machine | already `TOUCH.enabled`-aware | PLAY / BACK in the home strip | optional |
| KrunchBurn (raid cut-in) | the ch 6 raid | tap skips | "Tab / tap: skip" | – |
| Drive (Night of Freedom), BeepBeep | – | – | track B | – |

## 2. The schemes (README "Minigames by touch" has the full table)

- **Mashers** (bully, deadlift, the vignettes'): a tap anywhere, every finger counts; two thumbs drum (checked: the
  second thumb landing while the first is down counts, 3 pairs = 6 hits). Words: "Mash the screen (two thumbs!)".
  Before/after: `before-deadlift-play.png`, `games-bully.png`.
- **Flip It**: the tap area is the ring drawn round each problem (r 40 game px, about 58 CSS px). The smoke taps 34 px
  off the picture's centre, outside the picture, and every tap fixes it. `before-renovate-play.png` / `after-renovate-play.png`.
- **RuneScape**: CHOP (84 px, prime) = SPACE (walk to the nearest tree and chop; the timed ring hit, glowing gold while the
  ring closes); DROP ALL pops in with logs; RE-UP / ROLL / PUD (the game's word) when the game would take one; Log out
  lifted out of the strip. Won 99 Woodcutting by touch in the smoke (18 ring hits, drops and re-ups).
  `before-runescape-play.png` / `after-runescape-buttons.png`.
- **Crocodile**: pads out of the strip; each pad's touch area the whole column under the note lane; score under the lane;
  LEAVE left of pause. `before-crocodile-play.png` / `games-crocodile.png`.
- **Burpees**: tap anywhere is the right move; ▼ / ▲ kept under the thumbs; words. `after-burpees-play.png`.
- **Girlfriends / Facebrook / Cannon**: their own taps; the key captions gone; words.
- **Gig (safe cut)**: already tap-playable (a held thumb walks Benn, a tap on him prances); END GIG / LEAVE GIG moved left
  of the II, so the set can be finished by touch (the laptop's finish and pay).
- **Squeeze**: a tap anywhere squeezes, the circle says TAP (guarded hook). Won by tapping off the circle in the smoke.
- **Whack**: PLAY / BACK lifted out of the strip; its "Tap the pipes to whack." (now under the buttons) becomes the
  first-time cue when a game starts. `after-whack.png`, `after-whack-play.png`.
- **First-time cue** for every minigame (research S5): one line, 3.2 s, no touches taken (`after-runescape-cue.png`).
- **Rhythm lag**: the crocodile and the burpees take the phone's sound output delay (Web Audio base + output latency,
  capped 0.25 s; 0.042 s in emulation) plus "Rhythm sync" (now live) off a tap's judged time. Windows unchanged.
- **Pause**: wave 1's route everywhere (II → pause menu; wake → pause menu); the minigames' own corner buttons moved out
  from under it.

Phone-only assists (listed as required): Flip It's ring-sized tap area; the rhythm lag; tap-anywhere in the squeeze. No
game number, window, timer or reward changed.

## 3. Wording (hard rule 3)

UI lines swapped on phones only (`GAME_WORDING`, anchored to the whole caption): the how-to lines of DEADLIFT, FLIP IT,
BURPEES, THE GIG (Krebon's and watching), THE CROCODILE; the bully's and the cannon's "Tap / SPACE" (stage 1's row, scene
now listed); Girlfriends' "[1]"–"[3]"; Facebrook's "[n] " prefixes; RuneScape's hint, chat welcome, "Click here to
continue", "Drop all (D)" / "Re-up (G)" / "Roll (G)" / "Pud (G)", hover key notes; ClubCloseup's "ESC / CLICK: skip";
KrunchBurn's "Tab / tap: skip"; the Pit card's "▶ any key · A · tap"; VignetteScene's 5 "Tap / SPACE" mash/timing lines,
"WASD / ARROWS (or drag) to steer", "PARACHUTE TO FREEDOM [ E / SPACE / TAP ]".
Narrator tip swapped (one): squeeze.ts "Hit the buttons as they come up, fast, before she gets bored." → "Tap the
screen, fast, before she gets bored." (the rest of the line kept). Already covered by earlier rows: the gig intro's
"Tap / SPACE to prance", Boggor's "press E to", the golden juice's "press T".
Character lines in these scenes that mention a key: none (the "Tap" in VignetteScene 543-548 is the pub's name).
`tests/mobileWordingScan.test.ts` now includes these rows (no character line matched).

## 4. Research deviations

- M13 "decode the song into a buffer and judge on the context clock": not done; the crocodile already judges on the
  song element's own clock, the burpees on the scene clock; the phone's extra output delay is subtracted instead.
- S8 calibration screen: not built; the Rhythm sync slider (Phone settings) is live. Worth a device check (research Q10).
- S5: one-line cue only (no "How to play" in pause, no skip after three failures).
- Audit's deadlift +25% per tap: not done (laptop numbers kept); two thumbs at 10 taps/s won Jenko's lift with 10.9 s
  left. Krezwonk without the HGH step needs about 8.3 taps/s (as hard as on a laptop): judge on a device.

## 5. Tests

- `tests/mobileGames.test.ts` (16): every swapped caption still exists in the source as written; none keeps a key name;
  anchoring; the squeeze tip; `rhythmLag`; the crocodile's columns; RuneScape's buttons and word; the corner and strip
  maths; the cues.
- Smoke `--only games` (30 checks, iPhone profile): bully, burpees, crocodile, deadlift, girlfriends, Flip It, Facebrook,
  cannon, RuneScape won by touch; the gig (optional) held / tapped / finished with END GIG; a console replay back home; the
  squeeze won by tapping off its circle; the Pit card. The timing games run on a stepped clock (the game's loop stepped 60
  frames per game second, frames not drawn) because this machine ran at load 16 and 7-20 fps: real-time bots landed
  every tap 150-250 ms late there (a re-run alone at 23 fps passed). `GAMES_ONLY=` runs a subset.
  Result on 5502: 30 of 30 (1006 s).

## 6. Full check

FULLCHECK_RESULTS

## 7. Judged against "mega intuitive and fun"

Every compulsory minigame is now one obvious verb under the thumbs, with nothing under the II or in the home strip, and a
first-time line that says what to do. RuneScape is the big change: three thumb buttons instead of 14 px links. Still
not proven: rhythm feel on a real phone speaker and Bluetooth (the lag is the browser's own reading), the deadlift for an
un-juiced Krezwonk, and whether the cue over the middle of Whack's pipes is in the way for its 3 s.

## 8. Gaps / for review

- Boggor's photo quest (safe cut) was not re-tested here: it is a Hub walking quest using wave 1's tap to use and stage 2's
  wording; worth a look in stage 4.
- The game's own Drop all / Re-up canvas buttons stay in RuneScape's bottom strip (the thumb buttons replace them).
- `fixMinigame` finds the crocodile's pads, LEAVE / END GIG and RuneScape's Log out by shape (size / text): a change to
  those in the game would quietly skip the fix (the smoke checks each).

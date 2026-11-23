# s2-03 · Stage 2, menus and dialogue builder, part 1: readability, conversations, the Phone settings page

Branch `mobile-ui` (worktree `scratchpad/mobile-ui-wt`), made from `mobile` at `e8cf3f4f`. Commits listed at the end.
Nothing was pushed. The main checkout was not touched.

**The short version.** On a phone, every conversation in the game now has SKIP / LOG / AUTO (and II where the game has a
pause menu), its text is 16 CSS px, long lines go into more boxes with the same words, choices are big rows that need a
deliberate tap, and Android Back never skips. "Bigger text" is on by default (labels at least 11 CSS px), and the menus
were re-laid out so nothing overlaps and every target is at least 44 CSS px. There is a Phone settings page. The idle
stick moves off the player and pulses (with ACTION) the first time it matters. The narrator's control tips read in touch
wording. **No game file outside `src/game/mobile/` was edited**: everything is done from the phone chunk, which a laptop
never downloads.

## Checks (all run by me, servers from this worktree: 5222 normal, 5232 ALT)

| # | Check | Result |
|---|---|---|
| a1 | `desktop-fingerprint --check --only shell,front,newgame,hub,meeting,dungeon` | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** |
| a2 | `desktop-fingerprint --check --only boss,side,places,minigames,finale,alt` | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** |
| b | `--profile` touchlaptop / ipad / fire7 (front, newgame), androidtab (front, newgame, hub) | 16/16, 16/16, 16/16, 29/29: all **OK** |
| c | `npx vitest run tests/desktopInvariants.test.ts`; that file, `tests/fingerprints/`, index.html | 19 of 19; all three unedited (`git diff e8cf3f4f` empty) |
| d | `npx tsc --noEmit`; `npx vitest run` | clean; 40 files, 418 tests, all pass |
| e1 | `mobile-smoke.cjs`, ALT (5232), all sections | **222 of 222, MOBILE SMOKE: OK** (on `6574b6a2`; the commit after it touches the smoke test only) |
| e2 | `mobile-smoke.cjs`, normal (5222), all sections | **222 of 222, MOBILE SMOKE: OK** (final run, on `07bfb301`; an earlier run had one timing miss in the stage 1 held-press check, fixed in the test) |

Logs: `scratchpad/mobile/work/s2-ui1/` (`fp-*.log`, `smoke-main.log`, `smoke-alt.log`, `smoke-main-rerun.log`).
Screenshots (1x CSS): `scratchpad/mobile/shots/s2-ui1/` (and `smoke/` for the new sections' own shots).

## What changed, screen by screen (phones only)

| Screen | Before (stage 1, Bigger text off) | Now |
|---|---|---|
| Every conversation (Dialogue overlay, Meeting, Cutscene, Vignette, Lair, Home, Club, Kreddle, Venue, Pub, raid...) | Body 11.6 CSS px; footer "▼ E / Space · Tab skip"; no skip, log or pause by touch; 12 taps for the welcome, about 250 for the first Town Hall visit | Body 16 CSS px (name 14, its title on the name's row); footer "▼"; **AUTO · LOG · SKIP ▸▸** pills on the box's top edge (and **II** in meetings, cutscenes, vignettes); a long line split into more boxes (same words); Back closes the log / pauses a meeting, never skips |
| Choices | 25 CSS px rows, "1." in front, picked on touch-down (the tap that ended the line could land on one) | 48 CSS px rows, 10 apart, nearly full width, 16 CSS px, no numbers; the question shown whole first; a row is picked only by a touch that went down and up on it, 180 ms or more after the rows appeared; above the box when they fit, else over the screen with the question on top |
| Messenger pings / reactions | 11.6 / 11.6 CSS px; "REACT (1-5 or click)", numbers by each circle | 16 CSS px (two lines a box, more boxes if needed); "REACT"; no numbers; the same deliberate-tap guard on the circles |
| Title | Four 29 CSS px buttons 33 px apart; ADD TO HOME SCREEN 35 px tall; the key line "WASD · Mouse · ..." | Two columns of 44+ px buttons (CONTINUE across the top), words at 12.5 CSS px; ADD TO HOME SCREEN 44 px tall (P14); the key line gone |
| Pause menu | 10 or 11 rows 25 CSS px apart; with the floor on, the objective ran into RESUME (P12) | Three columns (two when there are few) of 44+ px rows with up to 12 px between (SAVE and QUIT never a slip apart); the objective on its own lines above; a **📱 PHONE SETTINGS** row after SETTINGS |
| Settings (title and pause) | Steppers 29 x 22; "Lock mouse to game window" | Two columns of rows, − / + 44 x 44, tabs 44 px, a **📱 PHONE** tab (the Phone settings page), no mouse lock row |
| Phone settings page | (did not exist) | DOM page: every setting in two columns of 48 px rows with a help line, toggles / 44 px segments / 44 px − + ; **Phone layout AUTO / ON / OFF**; "🎮 A Bluetooth controller works"; RESET, DONE, Back |
| Death, banter, difficulty, tribunal pages | 29 to 40 game px rows | 44 CSS px rows, two columns when one would not fit (difficulty at 340 tall), texts re-flowed under them |
| Character select | "Proctus covers as" over the quote, the passive over "If unselected" (P12) | 3 x 3 smaller face cards, a wider details panel re-flowed top to bottom, the stat bars two to a row, ◀ BACK top left, PLAY AS under the grid (both 44 px); no overlaps for any of the nine at 750x340 |
| Difficulty / Banter | Blurbs ran out of their cards, the notes over the buttons, "↑/↓ or 1–5 to pick · ENTER / A ..." | Wider cards as tall as their words, ◀ top left, notes under the cards (at 750x340 the how-to line and then the multipliers line step aside), "Tap one, then tap it again to go on / start" |
| Save slots | Five small lines a slot overlapping at the floor; 🗑 40 x 28; key hints | Four lines a slot (chapter and place on one), the objective on one line, 🗑 and BACK 44 px, "Tap a slot to load it" |
| TV | Subtitles 9.4 CSS px; "Space / click", "Tab", "D", "Esc" under the buttons | Subtitles 16 CSS px; no key captions |
| Home's laptop (group chat) | 7.9 CSS px messages | 16 CSS px, newest at the bottom, as many as fit |
| Home (walking) | At 750x340 the idle stick sat over the player at the far left | The idle ring moves beside / above the player (a fixed stick goes see-through instead); the stick and ACTION pulse until first used |

Measured with `textSizes()` / the smoke test's text roles: no text under 11 CSS px on the title, settings, pause menu,
character select, conversation scenes; reading text 16.4 to 16.6 CSS px (never under 15) at 844x390, 750x340 and 740x360.

Not done here (and why):
- **P16 (character select: tap selects, PLAY AS confirms)** is unchanged: the first tap still picks (part 2's menus).
- **The quests and dialogue log pages, chapter select, the TV guide, the jukebox, the Pit's loaner rack** are lists
  for research M10's native-scroll list (part 2). They fit the floor (their bottom buttons are 44 px) but still scroll
  with ▲ / ▼ buttons.
- **The keyboard CONTROLS page** is left as it is: the combat builder is putting a touch CONTROLS page in its place.
- **The TV picture** is still 58% of the screen width (scaling the set up is stage 3's TV work); its subtitles are now
  reading size but can take three or four lines over the picture.
- **The meeting's "NATIONAL REACTION DISPLAY" label** is a few px wider than its little screen at the floor.

## Conversations: the decisions

- **SKIP is the laptop's Tab** (`box.skipAll()`), one tap, no confirm: it stops at the next choice, reaction, broadcast
  or Kreltality, and every skipped line still applies its flags, sounds, callbacks and log entry (tested: flags set,
  the choice not taken). What was skipped is in the LOG. It is hidden while a choice is up (a skip set there would
  carry past the choice, which the laptop's Tab cannot do either).
- **AUTO** is phone-side for the visit (the game's own "Auto-advance dialogue" setting also counts and is shown lit):
  voice end + 700 ms, never before half the reading time; silent pages 1.2 s + 50 ms a character (1.5 to 8 s). A later
  page of a long line, read out once with its first page, gets its reading time.
- **Android Back (R3 follow-up)**: closes the LOG, the Phone settings page or the guide first; in a meeting, cutscene or
  vignette it opens the pause menu (exactly what Esc does on a laptop there); in a town conversation it does nothing.
  It never skips: Back means "get me out", players press it by reflex, and a skip cannot be undone.
- **Broadcasts the game makes you watch, Kreltalities, cine beats**: unchanged (the pills hide while the box steps
  aside; SKIP stops at them exactly as Tab does).
- **The Krezz Arms' table chats** keep their own bar (NEXT LINE / SKIP THIS CONVO / END): the pills step aside while it
  shows.

## Every hook outside `src/game/mobile/`

**None.** `git diff e8cf3f4f -- src ':!src/game/mobile'` is empty. index.html, main.ts, the Phaser config, the scene
list, `tests/desktopInvariants.test.ts` and `tests/fingerprints/` are unedited. Outside `src/` only tooling changed:
`scripts/mobile-smoke.cjs` (new sections, stage 2 defaults) and `tests/mobile*.test.ts`.

Everything is done from the phone chunk by wrapping, once, the game's own methods (the wrapper calls the game's method
first, then lays out what it built): `DialogueBox` (`play`, `destroy`, `renderLine`, `shownText`, `showNotify`,
`showChoices`, `showReaction`, `clearOverlay`, static `layout`), `MenuScene.render`, `TitleScene.create`,
`CharSelectScene.create` / `select`, `SaveSlotsScene.render`, `HomeScene.laptopPanel`, and each scene's `create` event
for Difficulty, Banter and TV. The table is in the README.

**For the merge with the combat builder:** the pause menu is laid out from whatever buttons it has (two or three
columns), so their CONTROLS entry, however they add it, is laid out with the rest; my 📱 PHONE SETTINGS row is added
from outside after SETTINGS (no MenuScene line to conflict with). Files we may both touch in `src/game/mobile/`:
`touchLayer.ts` (my changes: `placeGhost` / `updateGhost` and ACTION's `onDown` / `cue` class, about 50 lines),
`index.ts` (three constructors and a frame call), `css.ts` (appended blocks), `wording.ts` (rows appended),
`settings.ts` (the readability default, two option labels), `shell.ts` (`addBackHandler`), `README.md`.
`cues.ts` (`cueSeen` / `markCue`) is there for their first-time cues too.

## Narrator control tips swapped (phones only; the laptop line unchanged; every other word kept)

| Where | Laptop line (as written) | Phone |
|---|---|---|
| Home, the welcome (`HomeScene.ts:495`) | TIP: WASD / arrows (or the stick) to walk. E to use things. Have a look round: the telly works, the bed saves your game. | TIP: Drag on the left to walk. Tap things to use them. Have a look round: ... |
| Home, a night in (`HomeScene.ts:176`) | ... (The telly's on the left: walk up and press E.) | ... (The telly's on the left: walk up and tap it.) |
| Home, the gun rack tip (`HomeScene.ts:221`) | 💡 TIP: THE GUN RACK (on the wall, right). Walk up to it and press E. It's where... | ... Walk up to it and tap it. It's where... |
| Home (`HomeScene.ts:500`) | Why not watch some lovely TV? (The telly's on the left. Walk up to it and press E.) | ... Walk up to it and tap it.) |
| Home, playing as Mikey (`HomeScene.ts:497`) | TIP: You can become SANMIK whenever you like. Press V (or the SANMIK button) and you're SanMik: ... Press it again to go back to being you. | ... Tap the SANMIK button and you're SanMik: ... Tap it again to go back to being you. |
| Kreddle (`KreddleScene.ts:361`) | TIP: talk to the locals (E). Play the machines. ... | TIP: talk to the locals (tap them). Play the machines. ... |
| The playground side quest (`arcs.ts:889`, `890`) | HOW IT WORKS: walk up to the playground fence and press E to throw a sweetie. ... / ... and press E to take the photo. ... | ... and tap to throw a sweetie. ... / ... and tap to take the photo. ... |
| Krebon's stage (`arcs.ts:1244`) | Move left and right across the stage. Tap / SPACE to prance. ... | ... Tap to prance. ... |
| The Kreddle raid (`raid.ts:20`) | HOLD the attack button (mouse / J / the fire button) to spray CHEMICAL FIRE. ... | HOLD the attack button (the fire button) to spray CHEMICAL FIRE. ... |

Left for the combat builder (they name buttons that are theirs): the dungeon's "CONTROLS: WASD move · Mouse aim · ..."
(`dungeons.ts:530`), "press F to HEADBUTT" (`bosses.ts:304`, `ClubScene.ts:1118`), "JUMP over her (W / up)"
(`bosses.ts:360`), "(walk up, press E)" in the Cronster fight (`bosses.ts:531`), the run-and-gun legends
(`citadel.ts:33`, `63`). `NARRATOR_TIPS` takes their rows.

## Character lines that mention keys (left exactly as they are)

None is a control instruction. The lines a character says that contain a key or "press": DRONGUS, "“Press 1
for...SWASTIKA”" (`riffs.ts:377`, a joke about a phone menu); DRONGUS, "(Y)" (`riffs.ts:410` and a status, an
emoticon); CLAUDE, "...the key change happens four times in a row, each one into the same key..." (`ch7.ts:19`, music).
Stage 1 listed Mikey's "Press V (or the SANMIK button)" as a character line: it is a narrator `dir(...)` in
HomeScene, so it is in the table above.

## Judged against "mega intuitive and fun"

Better: a conversation never costs more taps than you want (SKIP, AUTO, tap to finish a line), the words are readable
without squinting, a choice can't be picked by the tap that ended the line, Back can't eat a scene, menus are big
enough to hit with a thumb, and the stick pulses until you've used it. Still not there: the dialogue box is the
laptop's box at a bigger size (three or four lines, so long speeches take more boxes); character select still commits
on the first tap; the long lists (quests, log, TV guide, chapter select) still scroll by buttons; the TV picture is
small.

## Tests

- `tests/mobileDialogue.test.ts` (23 tests): AUTO timing, the choice guard, where choices and pills go, Back, reading
  sizes, the box's capacity at the reading size on every phone size (pagination), narrator tips, the new touch
  wording, the Phone settings page's helpers, the idle stick kept off the player.
- Updated: `tests/mobileSettings.test.ts` (readability default on), `tests/mobileReadability.test.ts` (floor 11).
- Smoke: new sections `dialogue` and `settings2` (below); `phone`, `settings`, `read` and the diag check updated for
  the new defaults; two stage 1 checks made robust (the fixed-stick check walks left: earlier walks can leave the
  player at Home's right wall; the trophy-shelf bubble check stands the player a little left, since the bubble is
  wider with Bigger text and must sit inside the stick zone there); the Android held-press check (R4) keeps holding
  until the title is up (it read the scene after a fixed 1.3 s, which a loaded machine missed once).

## Commits (branch `mobile-ui`, on `e8cf3f4f`)

| Commit | For the player |
|---|---|
| `f38e23a4` | Conversations with SKIP / LOG / AUTO, bigger text on by default, menus for thumbs, a Phone settings page, the idle stick off the player and first-time pulses, the narrator's tips in touch wording |
| `cac70ab0` | Difficulty, Banter, save slots and the menu pages fit the bigger text; touch wording on the telly and the slots; the pills step aside for the Krezz Arms' chat bar |
| `6574b6a2` | Mikey's SanMik tip and the raid's fire tip in touch wording; no key names under the telly's buttons; README |
| `07bfb301` | Smoke test only: the held-press check waits for the title |

The worktree is clean; the servers are stopped; nothing was pushed.

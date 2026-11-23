# s2-04 · Stage 2, menus and dialogue builder, part 2: lists, shops, character select, the touch wording sweep

Branch `mobile-ui` (worktree `scratchpad/mobile-ui-wt`), on top of part 1 (`07bfb301`). Commits listed at the end.
Nothing was pushed. The main checkout was not touched.

**The short version.** On a phone, every long list in the game's menus is now a native-scroll list you flick with your
thumb (momentum, 52 px rows, 16 px words, 44 px tabs and ▲ / ▼ page buttons, the selected row in view, the place
remembered): the TV guide, the gun rack, the jukebox, the Kreltality trophies, the Krunch Pit's loaner rack, the
archive, QUESTS, the DIALOGUE LOG and chapter select. Every shop is a scrolling grid of tiles with the picked item's
detail and one BUY button beside it: a tap only picks, BUY buys, ammo goes by the box with − / +. The gun rack reorders
by dragging a ⋮⋮ handle, or ⬆ ⬇, or MAKE IT #1. Character select waits for PLAY AS (P16). The rest of the menus'
key hints read in touch words, and a smoke check walks the menus and walking scenes and fails on any key name outside
dialogue. **No game file outside `src/game/mobile/` was edited** (`git diff 07bfb301 -- src ':!src/game/mobile'` is
empty): everything is done from the phone chunk, which a laptop never downloads.

## Checks (all run at `ff8374b5`, both dev servers started from this worktree)

| Check | Result |
|---|---|
| (a) laptop fingerprint, `shell,front,newgame,hub,meeting,dungeon` (main + ALT) | 40 of 40 states identical, **DESKTOP FINGERPRINT: OK** |
| (a) laptop fingerprint, `boss,side,places,minigames,finale,alt` (main + ALT) | 25 of 25 states identical, **DESKTOP FINGERPRINT: OK** |
| (b) `touchlaptop`, `ipad`, `fire7` (front, newgame); `androidtab` (front, newgame, hub) | all **OK** |
| (c) `tests/desktopInvariants.test.ts` | 19 of 19 pass; it, `tests/fingerprints/`, `index.html` and `src/main.ts` unedited since `e8cf3f4f` |
| (d) `npx tsc --noEmit` / `npx vitest run` | clean / 461 of 461 tests in 41 files |
| (e) phone smoke, main (5222) | 142 + 94 + 33 = **269 of 269** (run in three `--only` slices: phone..settings2; lists, wording, guide, optout; town, dungeon, android, desktop), MOBILE SMOKE: OK |
| (e) phone smoke, ALT (5232) | 142 + 94 + 33 = **269 of 269**, the same three slices, MOBILE SMOKE: OK |

Note: an earlier full run was cut off at the `lists` section's end by the usage limit (the browser was closed under it),
which is why the smoke was re-run in slices; nothing failed on its own.

## What changed, list by list (phones only)

| Where | Before (part 1) | Now |
|---|---|---|
| TV on-demand guide (65 shows in a full run) | 7 rows of 25 CSS px inside the telly; "▼ 58 more" not tappable; tabs 16 px tall; scrolled by wheel or arrows only | A card over the telly (the ON DEMAND / SWITCH OFF buttons stay beside it): channel tabs 44 px (they scroll sideways), every show in a 52 px row with its channel chip and NEW / 🎁 NEW / ✓ SEEN, 📺 WHATEVER'S ON, the TV log line ("📺 Seen 6 of 65 · 🎁 59 Kreddle gifts to claim · 🔒 1 unlock later"); opens on the first show you haven't seen; a tap plays it |
| Gun rack | Rows squeezed to 27 game px with 26 px ▲ ▼; drag-to-reorder by mouse; "↑↓ pick · SHIFT+↑↓ move · B buy ammo" | Rows 52 px with a ⋮⋮ drag handle (dragging anywhere else scrolls), ⬆ ⬇ on the picked gun (yellow, so they don't read as the list's page buttons), ★ MAKE IT #1; the detail column: BUY with − / + boxes first (starts at what fills it as far as the money goes), then the stats as ●●●○○, mods, upgrades; 🩸 PERKS & GORE |
| Jukebox (90 tunes) | Two columns of 13 rows 17 CSS px tall, pages with 22 px ◀ ▶ | Two columns of 52 px rows, every tune in one scroll; STOP, SHUFFLE 44 px; NOW PLAYING underneath |
| Kreltality trophies | One text block that runs off the panel after 7 or 8 trophies | The list scrolls when there are more than 7 |
| Kreddle Exchange, Prize Counter, Home Furnishings | 12 cards a page, 34 px page arrows, a second tap on a card bought it, BUY's lower edge in the home-indicator strip | A scrolling grid of tiles (every item), the picked item's detail and a 52 px BUY above the strip; a tap only picks; ammo with − / +; the header, tabs, balances and ✕ stay the game's own |
| Krunch Pit loaner rack (19 guns, the perks) | 6 rows visible, "▼ more" not tappable, no touch scroll | All rows; BORROW / HAND BACK / BORROW MAX on each row (44 px); GUNS / PERKS tabs; DONE |
| Historical Archive | 13 records a page, 10 px rows, 22 px page arrows | All records in one list (locked ones dim), a tap opens the record; ◀ LEAVE 44 px and out of the strip |
| QUESTS | Scrolled with ▲ UP / DOWN ▼ | Native scroll, the three tabs 44 px |
| DIALOGUE LOG | 9 lines a page, ▲ OLDER / NEWER ▼ | Native scroll, opens at the newest line |
| Chapter Select (and the debug menu) | Arcs in two columns of 22 px rows; one tap replaced your save | Two columns of 52 px rows with headings; a tap picks, START ▸ on the row goes (it replaces your save); BOSS FIGHTS opens its page; PLAYING AS / DIFFICULTY in the header without their "(C)" / "(V)" |
| Character select | The first tap on a face started the game (P16) | A tap picks and shows them (PLAY AS nods); PLAY AS starts, or a second tap on the same face 300 ms or more later; the face that starts selected never starts on one tap; sliding off a face does nothing |
| Chapter Select password | The text box at y 176-203 of 390, where a landscape keyboard opens; 27 px tall | In the top quarter, 44 px tall (48 at 844x390), "Wrong password." and the buttons moved down to make room |
| The Lair, the Citadel roof | "Esc: skip scene" (no way to do it by touch) | A SKIP SCENE ▸▸ button that does exactly what Esc does there (`finish(true)`) |

Not turned into phone lists, and why: the console's games (10, two columns of 50 game px: they fit), the save slots
(part 1 laid them out), the pause menu and settings (part 1), the Pub's cards and the Krunch Pit's board (40 px rows:
good, the audit agrees). The wardrobe and the fridge are not in this build (the audit found the same: no wardrobe spot;
the fridge became the lava lamp). "The TV log" is the guide's footer line ("Seen n of m ...") and the ✓ SEEN badges: both
are in the phone list.

## Research checklist (M10, S11, S13, DEFERRED P16)

- **M10**: an HTML list over the canvas with `overflow-y:auto; touch-action:pan-y; overscroll-behavior:contain`
  (and `-webkit-overflow-scrolling:touch`); rows 52 px, 16 px text, tap on release; 44 px page-up / page-down (▲ ▼
  beside the list, shown only when it doesn't fit); the list remembers its position (per list and tab); watched shows
  marked; no touch reaches the canvas (`stopPropagation` on every touch event, not only start and end); channel tabs
  44 px tall, about five visible (they scroll sideways). LOG's "tapping a line replays its voice" is not done (the log
  keeps text only; part 1's LOG is the same).
- **S11**: the gun rack's drag keeps a tap and arrow alternative (⬆ ⬇, ★ MAKE IT #1). The drag is on the ⋮⋮ handle
  only, so a drag on a row scrolls the list.
- **S13**: tap selects and shows the detail with a separate BUY; quantities use − and + (ammo by the box, in the
  Exchange and on the gun rack); buttons act on release. Destructive buttons: the game's shops have no sell or
  discard; SAVE GAME and QUIT TO TITLE are 12 px apart (part 1); chapter select, which replaces your save, now needs a
  second tap (START); the save slots' 🗑 already asks to confirm (the game's own).
- **P16**: done (above).
- Deviation: "a list that already fits stays as it is" is kept for the TV guide (7 shows or fewer and one channel),
  the trophies (7 or fewer), the archive (13 or fewer), the dialogue log (4 lines or fewer) and the gun rack (one gun).
  Shops are always the phone layout: a shop that switched between the game's cards and the phone's tiles as you
  changed tab (1 page vs 2) would be harder to learn than either, and S13's "tap picks, BUY buys" needs the phone
  layout anyway.

## The touch wording sweep

Every visible text in the menus and walking scenes that names a key or the mouse now reads in touch words on a phone
(laptop lines unchanged). New rows in `TOUCH_WORDING` (wording.ts), and where they apply:

| Where (file:line) | Laptop | Phone |
|---|---|---|
| Hub, playground sign (`HubScene.ts:2363`) | KIDS DISTRACTED: 12s / 📸 Snap the cameras (E) | ... 📸 Snap the cameras (tap) |
| Hub, playground sign (`HubScene.ts:2364`) | 🍬 Stand by the fence and press E to throw a sweetie | 🍬 Stand by the fence and tap to throw a sweetie |
| Hub, toast (`HubScene.ts:2251`) | ...Walk to each 📸 camera in the playground and press E to snap it. | ...and tap to snap it. |
| Kreddle, kards (`KreddleScene.ts:1163`) | Higher or lower? (↑ / ↓) The long shot pays more. | Higher or lower? The long shot pays more. |
| Home, the book (`HomeScene.ts:597`) | SKIP ▶▶  (Tab) | SKIP ▶▶ |
| Home, gun rack, one gun (`HomeScene.ts:825`, `:1097`) | ...; X swaps down the list. / ↑↓ pick · SHIFT+↑↓ move · B buy ammo | ...; SWAP goes down the list. / (nothing) |
| Krunch Pit (`PitScene.ts:193`) | ←/→ (or tap ◀ ▶) sets the Heat: ... | Tap ◀ ▶ to set the Heat: ... |
| Loaner rack (`PitLoanScene.ts:120`, `:122`) | DONE (ESC) / ←/→ tabs · ↑/↓ pick · ENTER borrow / hand back · tap twice on touch | DONE / Tap one, then tap it again to borrow or hand back (under the phone list) |
| TV guide (`TVScene.ts:458`) | ↑↓ pick · ←→ channel · ENTER watch · ESC whatever's on | (nothing) |
| Pause menu (`MenuScene.ts:303`, a phone already on the home screen) | ⛶ FULLSCREEN   (Alt+Enter) | ⛶ FULLSCREEN |
| Exchange, LADS tab (`MenuScene.ts:41`) | Drinking pussy juice (Q) knocks everything around you flying. | ... pussy juice (HEAL) ... |
| Exchange toast (`MenuScene.ts:970`) | ... Equipped. X to swap weapons. | ... Equipped. Tap SWAP to swap weapons. |
| Character select, Kreblar (`CharSelectScene.ts:102`) | ...  Press V to become SANMIK whenever you like. | ...  Tap the SANMIK button to become SANMIK whenever you like. |
| Chapter select (`DebugScene.ts:272`, `:274`, `:276`) | PLAYING AS: X  (C) / DIFFICULTY 3/5: Normal  (V) / (tap to change) | without the key |
| Ending (`EndingScene.ts:78`, `:150`, `:194`) | (click, or press 1 · 2 · 3 · 4) / click to skip / (click, or press 1 / 2) | (tap one) / tap to skip / (tap one) |
| Story stills (`gfx/Cine.ts:70`) | click / Tab: skip | tap: skip |
| Flyovers (`hub/flyover.ts:490`) | SKIP  ▸▸   (Space / Esc / tap) | SKIP ▸▸ (tap) |
| Lair, Citadel roof (`LairScene.ts:117`, `citadel/RoofCutscene.ts:93`) | Esc: skip scene | SKIP SCENE ▸▸ (a button) |

How it is applied (wording.ts): the walking and menu scenes in `UI_TEXTS` now also *watch* every Text they make: a later
`setText` that matches one of that scene's patterns is reworded, anything else is shown as set (the playground sign,
the kards and the Pit's Heat line change as you play). In story and conversation scenes (TV, Lair, RoofCutscene,
Ending, and the stills and flyovers wherever they play) only whole UI captions are reworded, matched exactly from
start to end when the text is made (`STORY_UI_LINES`, every pattern anchored `^...$`, tested). Stage 1's test that
`UI_TEXTS` never names a conversation or story scene still passes unchanged.

**Narrator control tips swapped in this part: none.** (Part 1's are listed in its report.) Every row above is a UI
string, not a line in the dialogue box.

**Left for the combat builder** (fight HUD and the old canvas pad): the dungeon's "CONTROLS: WASD move..." and
"SIDE-ON CONTROLS: A / D to run..." narrator lines (`data/dungeons.ts:512`, `:530`), "press F to HEADBUTT"
(`bosses.ts:304`, `ClubScene.ts:1118`), "(walk up, press E)" (`bosses.ts:531`, `finaleKrelford.ts:203`), the run and
gun legends (`citadel.ts:33`, `:63`), "Untie Mollor first (E)." (`dungeons.ts:645`; through hint() it would read
"(tap)"), the Kreltality's "(K)" / "(ESC)" (`Kreltality.ts:144`, `HeroPassengers.ts:510`), the dungeon toasts
(`DungeonScene.ts:1529`, `:3144`, `:3253`, `:3343`, `:3901`, `systems/squeeze.ts:65`, `:68`), the boss hints
(`Bosses.ts:977`, `:1314`, `:1381`), the weapon picker's line (`WeaponPickScene.ts:45`, the combat builder already has a
row), the Tutorial (`TutorialScene.ts`, their rows), the finale's "Esc: skip fight / scene" and "any key · click · tap"
(`FinaleScene.ts:87`, `:1185`), the Citadel's "KREDDLE EXCHANGE (E)" (`Citadel.ts:1086`, `:1141`).

**Minigame strings for stage 3** (instructions that name keys; untouched here):
- `combat/Wonk.ts:96` "TAP R / SPACE / CLICK / pad to flap it up! Keep it in the KREZZ ZONE (bright middle = PERFECT)"
- `combat/GroupWonk.ts:223` "MASH R / SPACE to pump · press ON THE BEAT when a lad lights up to bring them in"
- `club/ClubCloseup.ts:574` "ESC / CLICK: skip"
- `ClubScene.ts:1172` "TAP R / SPACE / CLICK to flap it up! Keep YOUR gauge in the KREZZ ZONE. First to krezz properly wins."
- `DriveScene.ts:327` "HOW TO PLAY: SanMik drives and does the jumps. Hold the mouse (or your finger) to fire the machine gun: it never runs out. Right-click, Space or F (or ROCKET) fires a rocket.
- `DriveScene.ts:327` "HOW TO PLAY: Gabor drives and does the jumps (somehow). Hold the mouse (or your finger) to fire the machine gun: it never runs out. Right-click, Space or F (or ROCKET) fires 
- `DriveScene.ts:811` "MASH (tap / Space) to shift into the highest gear!"
- `finale/SsjBrawl.ts:1803` "J / click: PUNCH (mash = FLURRY)   K / right-click: KICK   R: KI BLASTS (hold)   Space: VANISH   E: BLOCK (hold)"
- `VignetteScene.ts:821` "Tap / SPACE to flap it up. Keep it in the zone. Mm fuck yes."
- `VignetteScene.ts:1600` "TAP / SPACE to shove Polson through the turnstile"
- `VignetteScene.ts:1844` "TAP / SPACE: rub the lamp (sorry)"
- `VignetteScene.ts:1844` "TAP / SPACE: help SanMik rub the lamp (sorry)"
- `VignetteScene.ts:2072` "TAP / SPACE: unblock the jets (3 of them, 6 good jabs each)"
- `VignetteScene.ts:2839` "TAB: skip advert"
- `VignetteScene.ts:3359` " A/P: DRUGS "
- `VignetteScene.ts:3522` " A/P: DRUGS "
- `VignetteScene.ts:3638` "WASD / ARROWS (or drag) to steer"
- `VignetteScene.ts:3677` "PARACHUTE TO FREEDOM  [ E / SPACE / TAP ]"
- `VignetteScene.ts:3906` "Tap / SPACE when the food reaches his mouth. NOT the salad."
- `hub/drugs.ts:4` "Press D to take drugs"
- `kreddle/WhackScene.ts:375` "Q W E / A S D / Z X C (or numpad, or click) to whack · ESC to leave"
- `kreddle/WhackScene.ts:835` "SPACE: again  ·  ESC: back to the Strip"
- `kreddle/KrunchBurn.ts:149` "Tab / tap: skip"
- `BeepBeepScene.ts:171` `HOW TO PLAY: steer with A / D (or the arrows, or hold your finger left or right of the wheel). W to floor it, S to brake, SHIFT to boost. E (or H) honks the horn: everyone
- `BeepBeepScene.ts:313` "SHIFT BOOST · E HORN"
- `MinigameScene.ts:210` "Tap / SPACE to vent. The group chat has been a lot this week."
- `MinigameScene.ts:271` "Mash Tap / SPACE. Don'
- `MinigameScene.ts:442` "Click problems before they ROT (or arrows/WASD to pick, SPACE/E to fix). Fix them quickly in a row for a multiplier."
- `MinigameScene.ts:708` "Ring closes → ▼ DOWN to drop · ▲ UP at the bottom to explode   (↓ ↑ / S W / Space / tap ▼ ▲)"
- `MinigameScene.ts:1341` "A/D or ← → (or hold left/right of the screen) to move · SPACE / tap Benn to prance"
- `MinigameScene.ts:1514` "Move A/D or drag low · SPACE / tap high to throw underwear at Krebon · F / tap a mosher to PUNCH · knock stage invaders off with a throw"
- `MinigameScene.ts:1765` "SanMik ft. the entire cabinet · ← / A = LEFT HAND · → / D = RIGHT HAND · ↑ / W / SPACE = CHOMP"
- `MinigameScene.ts:2090` "SPACE / TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them."
- `side/colonEntry.ts:114` "click / Tab: skip"
- `minigame/runescape.ts:101` "Re-up (G)"
- `minigame/runescape.ts:122` "Roll (G)"
- `minigame/runescape.ts:150` "Pud (G)"
- `minigame/runescape.ts:317` "Shift-click: drop all"
- `minigame/runescape.ts:337` "Drop all (D)"
- `minigame/runescape.ts:382` "Esc"
- `minigame/runescape.ts:403` "Click / tap a tree to chop it. When the ring closes, tap it (or SPACE) for bonus XP."
- `minigame/runescape.ts:803` "Click here to continue"
- `minigame/runescape.ts:890` `Woodcutting level ${level}. ${fmt(xpAt(L))} XP.`
- `minigame/runescape.ts:1072` "Click a tree to chop it. Tap the ring as it closes for bonus XP."
- the Kreddle machines' key bindings (`KreddleScene.ts` SPACE / ESC / ENTER / TAB on the slots, claw, wheel, kards: keys only, their texts are already touch words), the Whack-a-Drongus captions (`kreddle/WhackScene.ts:273-280`)

## Character lines that mention keys (left exactly as they are)

None is a control instruction; all stay word for word on every device.

| File:line | Who | Line |
|---|---|---|
| `src/content/riffs.ts:377` | DRONGUS | “Press 1 for...SWASTIKA” (a joke about a phone menu) |
| `src/content/riffs.ts:410` | DRONGUS | (Y) (a thumbs-up emoticon) |
| `src/content/dialogue/drongusStatuses.ts:27` | DRONGUS (a status on the laptop) | ur last poste woz so tru!! (Y) |
| `src/content/dialogue/drongusStatuses.ts:81` | DRONGUS (a status on the laptop) | Southgate’s on William Hill ! I can’t quite see what he’s betting on, but he’s repeatedly pressing the “0” on his phone’s keyboard ! |
| `src/content/chapters/chapters.ts:298` | KREZWONK | I've foreseen this moment. I'm going to press a button. I've never pressed a button. |
| `src/content/ch7.ts:19` | CLAUDE | ...The way the key change happens four times in a row... (music) |
| `src/content/citadel.ts:112` | (a heckle in the gig) | NOT DURING THE KEY CHANGE! (music) |
| `src/game/scenes/MinigameScene.ts:1235`, `:1238` | the group chat in a minigame | "...allowed to break rules (Y)", "Admin (Mikey): it is now (Y)" (emoticon) |

## Every hook outside `src/game/mobile/`

**None.** index.html, main.ts, the Phaser config, the scene list, `tests/desktopInvariants.test.ts` and
`tests/fingerprints/` are unedited. Outside `src/` only tooling changed: `scripts/mobile-smoke.cjs` (sections `lists`
and `wording`; the `phone` section's character select step now taps a face then PLAY AS) and `tests/mobileLists.test.ts`
(new). All the wraps are listed in the README (stage 2 part 2 table).

**For the merge with the combat builder:** files we may both touch in `src/game/mobile/`: `index.ts` (two
constructors, a back handler, two frame calls, the `lists` entry on `__krelMobile`), `wording.ts` (rows added to
`TOUCH_WORDING` including two at the front, `UI_TEXTS` rows, the new `watchText` / `STORY_UI_LINES`, `hookScenes` now
walks every scene), `screens.ts` (P16, the password, the skip buttons, the archive's LEAVE), `README.md`. My new files
(`lists.ts`, `listLogic.ts`, `listScenes.ts`, `shops.ts`) are separate. The combat builder's `combatWording.ts` rows
(SWAP, HEAL) are the names my wording uses.

## Judged against "mega intuitive and fun"

Better: every list moves under your thumb the way every phone list does (flick, momentum, it stops at the ends), you
can see a whole TV guide or rack instead of six rows, nothing in a list fires when you meant to scroll, a shop never
buys on the tap you used to look at something, ammo can be bought a box at a time, character select lets you look
before you choose, and the menus stop naming keys. Still not there: the gun rack's detail column is narrow at 844
wide (the long stats text scrolls inside it); the shop tiles use the game's art but not its gold card frames; the TV
guide covers the telly's set while it is up; the LOG and the dialogue log don't replay voices; the canvas tabs of the
shops (33 CSS px drawn, 44 px tap area) are smaller than the phone list's own; everything was checked in an emulator
(Playwright), not on a real iPhone (momentum scrolling in particular is the browser's own and could not be felt).

## Tests

- `tests/mobileLists.test.ts` (new, 45+ tests): paging, scroll-into-view, which lists stay the game's own, the drop
  slot of a drag, ammo by the box and the capped purse, character select's second tap, every new wording row (and
  that a laptop sees the lines as written), every UI_TEXTS / STORY_UI_LINES pattern matches its line and the story
  patterns are whole-line, characters' lines untouched.
- Smoke `lists` (44 checks) and `wording` (2): see the header of `scripts/mobile-smoke.cjs`.

## Commits (branch `mobile-ui`, on `07bfb301`)

| Commit | What changed for the player |
|---|---|
| `046c1bab` | Phone mode: long lists scroll with your thumb, shops pick before they buy, character select waits for PLAY AS |
| `727b92a7` | Phone mode: skip buttons for the Lair and the Citadel roof, tidier gun rack and password box, flyover skip in touch words |
| `ff8374b5` | Phone mode README: the lists, the shops, character select and the touch wording sweep (stage 2 part 2) |

The worktree is clean; the servers are stopped; nothing was pushed.

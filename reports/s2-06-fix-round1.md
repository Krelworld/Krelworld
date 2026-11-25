# Stage 2 fix round 1 (FIXER)

Worktree /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt, branch `mobile`, base 56c786a8. One run, not cut off.
Worktree clean, servers stopped. Nothing pushed.

## Commits (56c786a8..06d2ac08)

| Commit | Findings | For the player |
|---|---|---|
| 49095c62 | P1, R1, R2, F1, F2, F6, F7 | Archive list has ◀ LEAVE (Back leaves too); FIRE held through the end of a fight no longer leaves a held attack (Mikey punched); a resting / off-centre controller never hides the touch controls; jumps: no second full jump at 120/144 Hz, a press during a dodge or hit-stop jumps after it, coyote judged at the press, down-right + JUMP jumps |
| 4d46b55c | F3, F4, F5, F8 | Auto-fire targets an enemy the gun can reach; side-room look-ahead holds 35% / 65% at any frame rate; Android cutouts no longer push SPECIAL onto DODGE / READY onto HEAL; the fight's fullscreen offer sits 12 px under pause and READY below it |
| 92fab6e6 | P7, R4, R3, F9, F10 | Kreltality: the phone's two buttons are the only targets, countdown ring on KRELTALITY, 400 ms arm delay, re-placed on layout; hero passengers' prompt gets the same; Cronster hostage tags / Citadel sign without the E key; finale brawl has II → carry-on card with SKIP FIGHT; mash taps queued one a frame |
| a514a626 | P2, P3 | Pit: put back ≥120 px short of the edge, the held stick waits; pits / movers / crushers make JUMP and FIRE see-through |
| deba9dea | P4, P6, P8, P9, P10, P11, P12 (wording), P13, P14, P15, P16, R5(c) | SKIP confirm; story bulletins' NEXT SHOW reads SKIP; flyover skip pill; chapter select second tap keeps the pick; Pub cards and ticker; gun rack line; Hub toasts clear of pause; WONK title; Controls picture fixes; IBS caption / chip; tutorial SWAP wording; weapon chip full name; Vibration hidden without vibrate; captions and ▼ out of the strip; the whole-game wording scan test |
| 7741496e | P2 (refined), R5(b) | After a pit the stick only stops walking you *toward* it (until the thumb is back in the middle or JUMP, 3 s max); smoke section `review1` |
| f43a0c64 | P8 test | smoke measures the confirm while it shows |
| 1e48090d | R2 (follow-up) | a pad that appears after earlier touches still takes over on its first press (found by the side smoke) |
| 06d2ac08 | — | README |

## Findings and what was done

Each was checked against the code first; the browser checks are the smoke runs listed under Verification plus the
reproductions noted.

| ID | Real? | Action | Root cause / fix / test |
|---|---|---|---|
| P1 (blocker) | Yes (the list rect 12..352 x 62..502 covers LEAVE moved to y 466) | Fixed | `listScenes.ts` archive adapter gets `back: ◀ LEAVE → sc.leave()`; index.ts Back handler leaves the Archive (not mid-reenact). Smoke `review1`: LEAVE on the list, tap leaves to the Hub |
| P2 | Yes (respawn at lastSafeX, held stick walks back in) | Fixed | Guarded hook in `SideLevel` pit respawn → `side.pitRespawn`: `pitSafeX` puts you ≥120 px short of the edge (never nearer than the game's spot, never in another gap); the stick can't walk you toward the pit until it is back in the middle or JUMP is pressed (3 s max); walking away works. The game already gives 1200 ms of invulnerability. Unit tests (pitSafeX) + smoke: held 2.6 s → 1 fall, x 809 vs edge 918 (before: a fall every ~0.75 s) |
| P3 | Yes | Fixed (C9 route) | Side rooms add pits (with their name area), movers and crusher paths to `layer.occluders` → JUMP / FIRE go see-through over them. The camera cannot lift the floor (the side room's view is the full room height); look-ahead is now exact at any frame rate (F4) |
| P4 | Partly | Fixed what was real | The telly plays on by itself (beats on a timer), so AUTO is not missing; the 15-25 taps were optional speed-ups. Real part: a story bulletin's only skip was labelled NEXT SHOW. On a phone it now reads SKIP (screens.ts, `once` bulletins only). No dialogue touched |
| P5 | Yes | Deferred, stage 3 | Needs paging subtitles inside TVScene's beat timing (TV scene work, stage 3 owns the TV). In DEFERRED.md |
| P6 | Yes | Fixed | Guarded hook in PubScene: taller cards on a phone (step up to 96, bounded by the board); `layoutPubCard` puts the title on top and the line under it; ticker headline under its show name. Measured at 844x390: every card's line ends 5-24 px inside its card; screenshot shows/s2-fix1/pub.png |
| P7 | Yes | Fixed | Kreltality.ts (guarded): canvas pair and bar hidden when the phone prompt is up; countdown as an SVG ring round the big button |
| P8 | Yes | Fixed | SKIP shows KEEP READING / SKIP SCENE ▸▸ (48 px, 12 apart) above the pills; closes after 5 s, on Back, or a second SKIP tap. Smoke checks size, gap, and that KEEP READING leaves the line where it was. "Keep the last objective on screen after a skip" not done: the objective toast / arrow already follow; noted |
| P9 | Yes | Fixed | The flyover hint becomes a 16 CSS px, 44 px tall pill in the top bar (`skipHintPill` via `WORDING_HOOKS`); tap anywhere still skips |
| P10 | Yes | Fixed | Legend rows tighter + "▼ more" cue while it scrolls; FIRE line follows auto-fire; MOVE's 1 styled like the rest; dot words at 11 px only where they fit (else the number; the legend has the word); ACTION line "Tap it, or tap that thing itself" scoped to "when you're next to something" (tap-the-thing works for the prompt's target) |
| P11 | Yes | Fixed | READY caption IBS; the 💨 chip hides while READY offers IBS |
| P12 | Yes | Wording fixed; font part deferred (stage 4) | Tutorial row now "SWAP (it appears once you have a second gun)...". Raising the 6-row card to 14-16 px overflows its NEXT button at 844x390 (rows +20%); needs re-paging; in DEFERRED.md |
| P13 | Yes | Fixed | `pickRow` keeps the pick on a second tap |
| P14 | Yes (all three) | Fixed | (a) gun rack line shorter on a phone (`rack-order`) and wrapped left of the coins; (b) cause: toasts made while pause was hidden (mode none after the flyover) used 950; `toastRight` now always reserves pause in the Hub; (c) WONK title x 548 on phones (guarded) |
| P15 | Yes | Mostly fixed; remainder deferred (stage 4) | Captions go over a button when they'd sit in the strip; the ▼ marker is lifted above it; flyover hint moved (P9). Left: the box frame's bottom edge (decoration) and floor labels in side rooms (needs a vertical camera); in DEFERRED.md |
| P16 | Yes | Fixed | Weapon chip name on up to two lines (11 px); Vibration row only where `navigator.vibrate` exists |
| F1 | Yes (reproduced by the 60 Hz-physics unit sim: first, first, air) | Fixed | `JumpBrain`: grounded is ignored while rising within 100 ms of take-off, so the stale `blocked.down` never refreshes jumps / coyote. Tests at 120, 144, 240 Hz (failed before, pass now) |
| F2 | Yes | Fixed | A press made while no step ran (gap >100 ms: dodge, hit-stop) is restamped to the first step after it. Unit test over 0-100 ms into 170-230 ms gaps (failed before) and a normal-rate 200 ms-old press still expires |
| F3 | Yes | Fixed | `pickTarget({ fireRange })`: when any enemy is inside the gun's range, only those are candidates (stickiness kept among them). Unit test with the reviewer's pistol and shotgun numbers |
| F4 | Yes | Fixed | `camLerp(dt)` (0.12/frame at 60 Hz, frame-rate independent) set on the camera each frame and `camLagPx` added to the look-ahead; DungeonScene skips `leadCamera` in phone side rooms (guarded). Unit sim: 35% / 65% within 1% at 30, 60, 90, 120, 144 Hz |
| F5 | Yes | Fixed | `islandGap()` = min(60, inset + 13): iPhone unchanged (47 → 60). Measured all cluster gaps ≥12 at 740x360 insets 16/24/32/40, 844x390/30, 915x412/28 (M and L); unit test added |
| F6 | Yes | Fixed | Coyote tested at `pressAt` (not the reading frame). Unit test at 30/60/120 Hz with a press 135 ms after the last grounded frame (failed before) |
| F7 | Yes | Fixed | The JUMP chord needs sideways under 0.35 (mostly vertical); (0.45, 0.6) and (0.55, 0.55) now jump |
| F8 | Yes | Fixed | `layoutSlots` keeps the fight's offer 12 px under pause at any height; `placeReady` starts READY under the offer while it shows; `layout()` no longer moves the offer to the walk slot in a fight. Unit test across heights and sizes |
| F9 | Yes | Fixed | The brawl adds its own II; it opens the shell's carry-on card with SKIP FIGHT (`shell.pauseCard`), which calls the Finale's own `finish(true)` (the laptop's Esc). Smoke: II → card → SKIP FIGHT → Finale gone |
| F10 | Yes (by reading; Wonk.ts deletes the edge once per frame) | Fixed | `MashQueue`: fingers queued (cap 4) and handed over one a frame in combat and the brawl; counters count delivered presses. Unit test |
| R1 | Yes (smoke check fails on the old code: attack stayed true on the KREZZED menu) | Fixed | `leave()` clears `TOUCH.attack`; `fireUp()` outside a fight does nothing. Smoke `review1` R1 (verified it fails without the fix) |
| R2 | Yes | Fixed | Handover on change: `padWoke` against `padRest` (taken on first sight, and after every touch take-over); buttons must go up→down, axes move >0.35 from rest. Unit tests (off-centre axes, drift, stuck button, frame-by-frame handover) and smoke `review1` R2 |
| R3 | Yes | Fixed | HeroPassengers `krelAllPrompt` mirrors Kreltality (guarded); hostage tag and Citadel sign reworded via `FIGHT_UI_LINES` (creation-time match in the Dungeon, no per-setText cost). Vitest checks the rows and that the game still writes those texts. The smoke wording walk was not extended to the Cronster room / plane (long setup); the vitest covers the strings |
| R4 | Yes | Fixed | `FINISHER_ARM_MS` 400; re-placed via `layer.onLayout` |
| R5 | Yes | Fixed | (a) padWoke tests; (b) smoke R1 step; (c) `tests/mobileWordingScan.test.ts` parses every `say()` and `{ s, t }` line in src (TypeScript API) and asserts no touch / fight / brawl rule and no narrator tip matches a character line (found >2000 lines, 0 matches); (d) see R3 |

No finding had `affectsLaptop: true`; every guarded hook added is `isMobile()`-only and the laptop fingerprint is unchanged.

## Dialogue (hard rule 3)

No dialogue or story text changed, added or removed. New phone-only UI wording this round (all UI, none spoken):
- Tutorial row (TutorialScene's touch column): "SWAP (it appears once you have a second gun), or tap your gun up top. ..."
- Gun rack how-to line: "Drag to order (or ▲▼). #1 is what you start with; SWAP goes down the list."
- Cronster hostage tag: "NAME\n(tied up: tap ACTION to free)"; Citadel sign: "🎁 KREDDLE\nEXCHANGE (tap)".
- Hero passengers' prompt buttons: "☠ ALL OF THEM" / "☠ KRELTALITY" / "spare them" (no keys).
- Story bulletin button label NEXT SHOW → SKIP; SKIP confirm "KEEP READING" / "SKIP SCENE ▸▸"; brawl card "SKIP FIGHT ▸▸".
No narrator line was newly swapped. Character lines that mention a key: unchanged, and the new whole-game scan test
shows no rule can reach any of them.

## Hooks added to game files (all guarded, listed in the README)

DungeonScene (leadCamera skip in phone side rooms), SideLevel (pit respawn x), Kreltality (hide canvas pair), HeroPassengers
(phone prompt), Wonk (title x), PubScene (card step / height). Not touched: index.html, main.ts scene list, Phaser config,
tests/desktopInvariants.test.ts, tests/fingerprints/.

## Verification

- (a) Laptop fingerprint at 7741496e (all game-file hooks in): first half 40/40 identical, `DESKTOP FINGERPRINT: OK`;
  second half 25/25 identical, `DESKTOP FINGERPRINT: OK`. Later commits touch only the phone chunk (pad.ts), the smoke
  script and the README.
- (b) touchlaptop, ipad, fire7 (front,newgame) and androidtab (front,newgame,hub): all `DESKTOP FINGERPRINT: OK`.
- (c) `tests/desktopInvariants.test.ts` 19/19; that file, tests/fingerprints/ and index.html: no diff from 56c786a8.
- (d) `npx tsc --noEmit` clean; `npx vitest run` 547/547.
- (e) Phone smoke, run in section batches (each under the 10 min tool limit):
  - Normal build (5206): phone..read 96/96; dialogue,settings2,lists 90/91 → the one failure was the new P8 check
    measuring the confirm after it closed (test fixed; dialogue rerun 28/28); wording,guide,optout,town 57/57;
    dungeon,combat 55/55; side,brawl 25/26 → side's controller check caught the R2 change ignoring a pad that appears
    after earlier touches (fixed in 1e48090d; side + review1 rerun 26/26); together,android,desktop 38/38.
  - ALT build (5216), all at the final code: 124/124, 65/65, 64/64, 72/72, 45/45 (370/370), each `MOBILE SMOKE: OK`.

## Gaps

- Nothing tried on a real phone (Playwright emulation only).
- P5 (TV subtitles) deferred to stage 3; P12 font size and P15 remainder deferred to stage 4, with a note on button
  size S crowding below ~360 px tall (pre-existing) — all in DEFERRED.md.
- P8's "keep the last objective on screen after a skip" not done (the objective toast and arrow already follow).
- R3's smoke wording walk was not extended into the Cronster room / Flight KR-069 (covered by a vitest on the strings
  and the hook code instead).

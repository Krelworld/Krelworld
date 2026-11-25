# Stage 3 wave 2, track B: special scenes, aiming, driving, TV (branch `s3-scenes`)

Worktree `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/s3-scenes-wt`, from 68584994.
New code: `src/game/mobile/scenes.ts` (driving from outside), `src/game/mobile/scenesLogic.ts` (pure rules),
`tests/mobileScenes.test.ts`, smoke section `scenes`. Two guarded hooks (DriveScene, BeepBeepScene), two optional
fields on boot.ts's `PhoneHooks`, three lines in `mobile/index.ts`. README section "Stage 3 wave 2: the special scenes".

## Commits
- 12076d44 Night of Freedom finger aim + ROCKET / SLOPPY; Beep Beep stick + BOOST / BRAKE / HORN; the finale card's
  SKIP SCENE; the advert / 3D epilogue skip pills; TV subtitles paged.
- 39dcd0a7 The raid's / rout's FIRE as a layer control; drawbridge SKIP pill 44 px; how-to pages SKIP; STEER caption;
  smoke section `scenes`.
- (README commit) the special scenes in the phone README.

## Which scheme each stationary gunner got, and why (the user's question)

**Night of Freedom (DriveScene): manual aim, "the finger is the crosshair", with a pull onto a car near the finger.**
Hold a finger on a car and the gun shoots it while the finger is down (the laptop's held mouse); a car within 90 game px
of the finger pulls the aim onto itself (the lock holds to 126 px), and a crosshair shows the aim (red and boxed when
locked). ROCKET (84 px, right thumb) fires where you aim; with no finger down it swings onto the biggest thing on screen
(tank > chopper > SWAT > unmarked > cop). SLOPPY appears above ROCKET only when it is full.

Played all three schemes over the whole 85 s chase with a bot thumb (iPhone profile, real touches; the bot's thumb lands
within ±30 game px of the car nearest the truck and re-aims every 350 ms, a second thumb fires ROCKET at tanks and
choppers):

| Scheme (Phone settings → Aim assist) | Kills | Score | Truck at the end |
|---|---|---|---|
| STRONG = the game's old touch auto-aim (a finger held anywhere) | 101 | 108,150 | 35 % |
| NORMAL (default) = finger + pull | 88 | 101,200 | 87 % |
| OFF = the bare finger | 51 | 48,800 | destroyed at 63 s |

Why NORMAL: when you can't move, choosing what to shoot is the whole game; holding a thumb anywhere while the gun picks
targets (auto-aim) is not playing. With the pull it is no harder than auto-aim (fewer kills, a much healthier truck,
because the thumb goes for the car about to ram you) and a first-timer gets it in two seconds ("Hold a finger on a car to
shoot it · ROCKET for the big stuff", shown once). The bare finger is clearly harder on a phone (the thumb's error), so
it is opt-in (OFF); auto-aim stays one setting away (STRONG). Caveat: a bot is not a person; this wants a real-phone
try (stage 4). (The bot's rocket taps briefly lifted its aim finger, which hurt every scheme alike.)

**The plane cannon (MinigameScene "cannon"): neither: the game's own tap timing, unchanged.** It is a timing game
(the barrel sweeps, a tap sets ANGLE, a second tap sets POWER), not an aiming one; drag-to-aim would change its
difficulty. A tap anywhere is the most forgiving target there is. Only its how-to line changed on a phone:
"SPACE / TAP: ANGLE, then POWER." → "TAP: ANGLE, then POWER." (UI line).

**Other gunners checked:** Kreddle's raid / rout (walk mode with a flamethrower): FIRE became a layer control (held by
touch id, slides off without letting go) and aim is the game's own touch aim (nearest target, else where you walk;
OFF = where you walk). The Kreddle Express chase vignette (drag to keep it in the sights) already works by drag. The
plane cabin (PlaneCabin) is a side room: stage 2's side controls. No other turret or on-rails shooter found.

## Per scene

| Scene | Before (phone) | After (phone) | Shots |
|---|---|---|---|
| Night of Freedom | Canvas ROCKET / SLOPPY 55 px in the bottom corners; a touch auto-aimed the nearest car; Phaser takes one touch, so tapping ROCKET while aiming stole the aim; score under II | As above; the canvas buttons hidden; the score left of II; the how-to line in touch words | before-drive-2.png → scenes-nof-chase.png, scenes-nof-aim.png |
| Drawbridge | Mash by tap (fine); SKIP a 13 px label under II | 44 px SKIP pill left of II | scenes-nof-drawbridge.png |
| Beep Beep | Steer by holding left / right of the wheel; no gas, brake, boost or horn on touch; "SHIFT BOOST · E HORN" | Left: a STEER stick (left / right, the layer's "x" stick, A / D held past 25 %). Right: BOOST (hold), BRAKE (hold), HORN (tap; dimmed while recharging, BOOST dimmed until the tank can light). Foot always down (W held; phone assist). The picture no longer steers on touch (guarded hook). Key hint hidden; timer / combo left of II | before-beepbeep-2.png → scenes-beepbeep.png |
| The cannon | "SPACE / TAP" line | "TAP: ANGLE, then POWER." | before-cannon-2.png |
| Finale between fights | II → PAUSED card, no way to skip (Esc on a laptop) | The card offers SKIP SCENE ▸▸ (the scene's finish(true)) | scenes-finale-card.png |
| Crobley advert (vignette) | "TAB: skip advert" in the home-indicator strip, no touch skip | SKIP ADVERT ▸▸ pill top right (sends the scene's own Tab) | scenes-advert.png |
| 3D epilogue | 11 px "skip ▶▶" link | 44 px pill (CSS only) | (not shot: three.js is heavy on this machine; class applied when the Ending runs) |
| How-to-play pages (Tutorial) | NEXT only; Esc closes on a laptop | SKIP ▸▸ pill top right | – |
| Raid / rout | Canvas FIRE (released on pointerout) | Layer FIRE (prime, or left of ACTION) | scenes-raid.png |
| TV (P5) | 16 px subtitles wrapped to 4-5 lines over the speaker | Paged two lines at a time, each page its share of the line's own beat time, the same words in order | tv-paged-1.png, scenes-tv-subs.png |

Checked and left as they are (fine by touch): pseudo-3D shots (`Pseudo3D.ts`, a tap skips), the Lair and the Citadel
roof (stage 2's SKIP SCENE), the ending's reaction / DELETE CHAT buttons, Exile and the cutscenes (stage 2's SKIP / LOG /
AUTO and choices), the Kreddle Express chase vignette (drag), the "TAKE DRUGS" button (tappable; its "PRESS D" label is
left as it is: it is a joke title, see gaps), the archive (stage 2), the concept boss and KiMode (stage 2's fight
controls; SPECIAL held charges the CUMEHAMEHA through TOUCH.held), the Citadel's Kreddle Exchange panel (LEAVE by tap,
readability's 44 px taps). Sizes: Drive and Beep Beep controls measured at 750x340 and 932x430 (+ insets): no overlaps,
nothing in the bottom 21 px.

## Phone-only assists added
- Night of Freedom: the aim pull (NORMAL), ROCKET's auto-target with no finger down.
- Beep Beep: the accelerator always down (BRAKE overrides, as S beats W).
- Raid / rout: the game's own touch auto-aim (it was already the touch path).

## Wording (rule 3)
Narrator / UI lines swapped on phones only (laptop unchanged; `SCENE_NARRATOR_TIPS`, `SCENE_UI_WORDING`; a test proves
no rule matches any character line, and that each reaches its line and keeps the words around it):
1. Night of Freedom how-to (narrator, both the line and its MIKEY variant): "Hold the mouse (or your finger) to fire the
   machine gun" → "Hold a finger on whatever you want to shoot to fire the machine gun"; "Right-click, Space or F (or
   ROCKET) fires a rocket" → "ROCKET fires a rocket"; "press R / SLOPPY" → "tap SLOPPY when it lights up".
2. Drawbridge (narrator): "MASH (tap / Space)" → "MASH (tap anywhere)".
3. Beep Beep how-to (narrator): "steer with A / D (or the arrows, or hold your finger left or right of the wheel). W to
   floor it, S to brake, SHIFT to boost. E (or H) honks the horn" → "steer by dragging left or right on the left of the
   screen. Your foot's down all the time: BRAKE slows you, BOOST boosts. HORN honks the horn".
4. The cannon's UI line: "SPACE / TAP: ANGLE, then POWER." → "TAP: ANGLE, then POWER.".
5. UI labels made into pills: "TAB: skip advert" → "SKIP ADVERT ▸▸"; the drawbridge's "SKIP ▶▶" → "SKIP ▸▸"; "SHIFT
   BOOST · E HORN" hidden.
Character lines in these scenes that mention a key: none found (DriveScene, BeepBeepScene, Drawbridge, TV, Finale, Lair,
Citadel, Raid / Rout, Vignette, Ending searched).

## Checks
(filled in below when the full check finishes)

## Gaps / for the coordinator
- Audio ("speech and sound effects are a little quiet on phones") was not in this track's role; not touched here.
- The 3D epilogue's skip pill was not exercised by the smoke (three.js on this machine); it is a CSS class on the link.
- "💊 PRESS D" (Polson's TAKE DRUGS beat, a vignette) stays as drawn: the button is tappable, but the label names a key.
  It reads as a joke title, so it was left for the coordinator (one `wordText` line if wanted).
- The TV picture itself is not enlarged (the audit's "scale the set up"): subtitles are paged instead; enlarging means
  re-laying the whole set.
- Rout (chapter 3) shares the raid's code path but was not driven by the smoke.
- The aim comparison is a bot; a real-phone feel test of NORMAL vs STRONG belongs in stage 4.
- DEFERRED.md's stage 2 items (P9, R8, R11, P10, P12, P14, P16, P4, R3) were not in this track's role.

# Stage 4 QA: blind phone player, second half and ALT (s4-02)

Throwaway worktree from `s4` (8b337a45), since removed. Dev servers: main on 5821, ALT (`VITE_KREL_ALT=1`) on 5831, both
stopped. I used one persistent Playwright browser (harness `scratchpad/mobile/work/s4qa-late/h.cjs`), which is closed now.
All input was real CDP touch.

Profiles:
- Android: 740x360, DPR 3, Android Chrome UA, no insets.
- Large phone: 932x430, DPR 3, iOS UA, insets 59/59/21.

Screenshots (34) are in `scratchpad/mobile/shots/s4qa-late/`. I changed no game code and made no commits.

Load during the run: one other agent was active and the load average was 4 to 8. The fps figures (12 to 49) are headless
software GL at DPR 3. They do not measure a real phone.

## What I played (Android 740x360 unless noted)

- **Front end.** I reached Chapter Select through the password box (krunt). The native-scroll chapter list and START
  worked. I started Chapter 4 from Home.
- **Chapter 4.**
  - Home: the telly by tap, then the TV with NEXT LINE / SKIP / SWITCH OFF.
  - Hub: dialogue, then the pause menu.
  - Factory door: ENTER by ACTION.
  - Crobley factory rooms 0, 1 and 4: run, jump, FIRE, DODGE, DASH, HEAL, BONGO.
  - Reinhardt: a Kreltality, then SHOOT THE FUEL TANK with HOLD FIRE, which works.
  - Then the explosion vignette and back Home.
- **Chapter 5 (SanMikverse).**
  - Job Centre fight, then the staff toilet by ACTION (TALK). The DonutToilet cutscene plays fully by taps.
  - Jam Queen, then Beep Beep (stick and a win), then Night of Freedom. It took 3 attempts: finger-aim, SLOPPY, ROCKET,
    the drawbridge mash, SKIP.
  - Nu Warehouse trip room, Rik, then the colon start.
- **Chapter 6.**
  - Plane aisle, the hero passengers (the finisher expired to SPARED), Captain Stanley.
  - Kreltality by the big ☠ button.
  - Cockpit: drugs, drag-to-steer and the ejector seat, then the long plane/Krelburger vignette chain.
  - Kreddle raid: stick plus held FIRE, 90+ torched.
- **Chapter 7.**
  - Citadel foyer (top-down), Drongus phase 1, Drongus phase 2 (side), the cauldron (USE), the roof cutscene.
  - Dark Drongus: shoot the frames, then the GROUP KREZZ mash by taps, then the Lair.
  - Krelford finale: shielded boss, fetch the bottle, inject 8 lads by ACTION.
  - Brawl: PUNCH/KICK, II, then SKIP FIGHT.
  - Spirit mash, the Lair, the ending (reaction choice, DELETE CHAT) and the 3D flyover.
- **Large phone 932x430 (iOS UA, insets).** The Club (tap to use to the Wonk-Off table) and the Venue (tap a performer:
  HIT works, LEAVE).
- **ALT on Android.**
  - Title and guide; the factory room (same narrator line, same controls); Night of Freedom (identical); Back twice.
  - No ALT-only difference seen. Same wording, layout and behaviour.

## Findings

Severity is my judgement. None of these can affect the laptop: each is either phone wording or touch reachability, or a
phone-only path.

### F1 (major): narrated control tips in late side rooms show keyboard keys on phones
- **What a player sees.** At the start of side rooms, the narrator box reads, for example, "RUN AND GUN: push right and
  they come to you. A / D run · W jump (again in the air to double jump) · S drop through · aim and fire as normal."
- **Where.** `combatWording.ts` `COMBAT_NARRATOR_TIPS` only matches the citadel wordings. I ran every DUNGEONS NARRATOR
  line through `narratorTip()` live in the page. Four are not swapped:
  - `data/dungeons.ts:1012`: Crobley factory room 0, chapter 4's first side room.
  - `:147`: the plane aisle, "RUN AND GUN, all the way down the plane: A / D run · W jump ... S drop · aim and fire as
    normal".
  - `:980`: the colon, "plant all four bombs (E on the red circles)".
  - `:389`: the Cuddle Tower climb, "CLIMB: W jump ... A / D move · S drop through" (chapter 3).
- **Repro.** Android profile → Chapter Select → 4 → factory door → ENTER. The third narrator line shows keys
  (`a14-factory-play.png` is just after). The same happens in ALT.
- **Fix.** Add NARRATOR rows for these four in combatWording (control words only, rule 3's narrator exception). A
  scan-style unit test over every `dir:true` / NARRATOR line with key tokens would stop regressions.

### F2 (major): the cockpit's "💊 PRESS D" pill (Flight KR-069) speaks keyboard, and only the pill itself takes a tap
- **What a player sees.** "TAKE DRUGS FOR CONFIDENCE / 💊 PRESS D". The layer is in mode none and nothing hints to tap.
  About 50 taps on the picture away from the pill did nothing. A tap on the pill works (`d11-pressD.png`).
- **Where.** `VignetteScene.ts:3600` (`takeDrugs`).
- **Same family.** `scenes/hub/drugs.ts:34` "💊 PRESS D TO TAKE DRUGS" (town) has an "(or tap the button)" line under it,
  but still names D. Neither string matches any wording rule: `touchWording` returns them unchanged.
- **Repro.** Android → DebugSkip `goBoss` Krozno (airport room 1) → beat him → Kreltality → advance the vignette.
- **Fix (phones).** Wording rule "💊 PRESS D" → "💊 TAP HERE" (and "... TO TAKE DRUGS" → "TAP TO TAKE DRUGS"). These are
  UI pills, not character lines. Optionally make any tap on the canvas take it on phones.

### F3 (major, known DEFERRED R3, wider than town): Back twice leaves the page mid-scene
- **What a player sees.** In Night of Freedom (ALT, Android profile), `history.back()` opens the pause menu. A second
  Back with no touch between navigates to about:blank, and the run in progress is gone.
- **Scope.** This is the same as R3 in town, but it also happens inside a minigame or scene, where a lost page costs
  real progress (the scene restarts from its intro).
- **Repro.** It is deterministic: `history.back()` ×2, 0.8 s apart.

### F4 (minor): "any key · click · tap" under MASH! in the finale's spirit-bomb mash
- **Where.** `FinaleScene.ts:1185`. It is not in `gamesLogic` / `scenesLogic` wording (the Krunch Pit's similar card is
  swapped).
- **What a player sees.** The mash itself works by taps. Only the hint names keys and the mouse (`g17-end-40.png`).
- **Fix.** A rule "any key · click · tap" → "tap tap tap" (or "tap").

### F5 (minor): the brawl's canvas "SKIP FIGHT ▸▸" still shows top right on phones, over the boss's name
- **What a player sees.** In the finale brawl the canvas corner label "SKIP FIGHT ▸▸" covers the end of "THE CONCEPT OF
  PAEDOPHILIA · ABRIDGED" (`g14-brawl.png`). The phone already offers SKIP FIGHT on the II card (`g16-brawl-pause.png`).
- **Docs.** README says the corner's "Esc: skip fight" hides on phones. It reads SKIP FIGHT now, so the hide rule may no
  longer match.
- **Also.** RoofCutscene and Lair show the small canvas "SKIP SCENE ▸▸" top right next to the dialogue's SKIP pill: two
  skips. This is cosmetic.

### F6 (minor): the finale's inject hint says "tap ACTION", but the button reads USE
- **What a player sees.** The toast reads "Inject each of the lads (walk up, tap ACTION)", but the button says USE. No
  control is labelled ACTION on screen.
- **Also seen.** The Job Centre STAFF TOILET verb reads TALK ("Talk to STAFF TOILET (ENGAGED)" is the game's own prompt
  text, so the verb is derived from it). It works, but reads oddly.
- **Fix.** A verb rule for `Inject *` → INJECT, and "tap ACTION" → "tap INJECT" or "tap USE".

### F7 (minor): "Point at a gun to see it" in Home's gun-rack narrator tip (shown after chapter 4) assumes a mouse
- **Where.** The Home 🔫 line, after the gun-rack TIP that is already touch-worded ("Walk up to it and tap it").
- **Fix.** A narrator wording row "Point at a gun" → "Tap a gun".

### F8 (minor): finale brawl, the player can be walked under the right-hand cluster
- **What a player sees.** Holding the stick right walks the Super Saiyan under PUNCH/BLOCK at the right edge, and the
  buttons stay opaque over him (`g15-brawl-after.png`).
- **Comparison.** Top-down and side fights make occluding buttons see-through. The brawl doesn't seem to.

### F9 (confirm known P12): Beep Beep's BRAKE / BOOST cover the speedo and MPH readout at 740x360 too (`c11-afterjam.png`)

### Not phone bugs, for context (game, all versions)
- **Difficulty with the chapter-select kit.** Chapter 4's factory lockdown killed a HOLD-FIRE two-thumb bot three times.
  With EASY or the debug kit it was fine.
  - I can't separate my bot's skill from difficulty, and the laptop has the same numbers. Worth a human feel-check on a
    phone at difficulty 3 with the chapter-select kit.
  - On a death retry, HP restarts at about 45 of 105, and the room's three intro narrator lines replay every retry.
- **Night of Freedom.** A truck loss replays all 11 intro lines. SKIP exists.
- **Design note on side rooms.** Holding FIRE pins the right thumb. Sliding from FIRE onto JUMP keeps firing and does
  not jump (measured). A player has to lift, tap JUMP (FIRE's 200 ms grace covers it), and put the thumb back. This is
  workable and matches the research's stated caveat. EASY removes it.
- **Known P9.** In the Club, the Wonk-Off started under my dialogue taps and I lost it at once, which is consistent with
  P9 (no II, starts 0.9 s after the last line). I could not get back in quickly (barred), so this is not re-measured.

## What works well (don't break)
- **Chapter Select.** Phone list, tap picks, START goes.
- **Tap to use.** The telly, the factory door, the toilet, the cauldron, the Venue performers (HIT) and the Club table
  all walk there and act.
- **Side rooms.**
  - Clean layout v2 (JUMP/FIRE/DODGE/DASH; HEAL and READY pop in) at 740x360.
  - A deliberate jump over the Candy Chute pit clears it easily.
  - Pit respawn plus pit lock behaves as documented.
- **Bosses.** The boss bar is clear of the chip. Kreltality's big ☠ button and SPARE work.
- **Fuel tank.** HOLD FIRE destroys the tank with no enemy targeted.
- **Cutscenes.**
  - The DonutToilet cutscene: full frame, pills clear of SanChz, 13 taps end to end.
  - VS splashes, p3d SKIP, the roof GROUP KREZZ by taps.
- **Night of Freedom.** Finger-aim, SLOPPY and ROCKET pills, and the drawbridge "MASH (tap anywhere)" with SKIP.
- **Cockpit.** Drag-to-steer ("Drag to steer"), and the ejector seat by tap.
- **Kreddle raid.** Stick plus held FIRE, its own HUD readable.
- **Finale.**
  - Bottle fetch (follow the arrow), the inject by ACTION, the brawl controls.
  - The II card with SKIP FIGHT.
- **Ending.** The reaction choice and DELETE CHAT by tap ("(tap one)"), and the 3D flyover's skip.
- **Large phone 932x430 with insets.** Club and Venue lay out well.
- **ALT.** Same as main everywhere I looked.

## Character lines that mention keys (left unchanged, as required)
None new found in the second half beyond those already listed in earlier reports. Every key-naming line I hit (F1, F2,
F4, F7) is narrator or UI text.

# s4-01: blind phone player, first half (chapters 1 to 3)

Role: a first-time player on an iPhone 14 held sideways (844x390, DPR 3, mobile Safari UA, insets 47/47/21 via `__krelMobile.setInsets`, real CDP touch), branch `s4` at 8b337a45 (main build, dev server :5801), in a throwaway worktree. I also spent about 10 minutes at 750x340 (Safari with its bars showing). Screenshots are in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s4qa-early/`.

## What I covered

- **Chapter 1 by touch only:** Enter gate, the Add to Home Screen guide, new game (character, difficulty, banter), Home, the flyover, the money tips and the town on foot and on the bike. Then the Town Hall meeting (SKIP, LOG, AUTO and a reaction choice), the mandatory broadcasts, the Wildern dungeon (3 rooms and the Kranky Krandall boss), WONK, IBS, the Kreltality, golden juice, planting the bombs, the posse "beat up Mikey" encounter, pause and Phone settings.
- **Chapter 2:** the TV and its On Demand list, the Old Flat, and the RuneScape woodcutting minigame. I failed it 3 times and did not finish it.
- **Debug use:** after 3 RuneScape failures I used DebugSkip, at 750x340, to reach Chapter 3's "Do The Crocodile" rhythm game. I used `__krel.tp` once, to get to the Town Hall after my scripted steering kept running into buildings. I used the debug API once more, `beatup.cancel()`, to get out of the softlock in B1.
- **Not reached:** the Krezz Arms brawl, the shops and the Kreddle Exchange, a side-scrolling room (so jumping is untested), and the Chapter 2 and 3 dungeons.
- **Test method:** for fights I paused the game loop between my actions, because I am much slower than a real player. This breaks real-time QTE windows, so I turned it off for every timing check below. Nothing timing-related below depends on it.

## Findings

### B1 BLOCKER: the posse "BEAT UP <name>!" encounter cannot be played on a phone and softlocks the game
- **What the player sees.** A lad walks up in town ("Let's beat up Mikey."), you find the victim, and three circles appear: `SHOVE [E]`, `PUNCH [F]` and `KICK [SPACE]`. Tapping the circle the prompt asks for does nothing. `hits` stays 0 after 50+ correct taps, with and without the loop pause. The prompts repeat forever ("Ha! Missed me! ...wait no"), because the fight has no timeout.
- **No way out on a phone.** The phone layer goes to mode `none` with `pauseButton:false`, so there is no stick, no II, and the Back gesture does nothing. Only a reload gets you out, back to the last save.
- **Cause.** In `src/game/scenes/hub/Beatup.ts` the circles are interactive children of a `ui` container that has scrollFactor 0, but the circles themselves keep scrollFactor 1. Their hit areas are therefore offset by the camera scroll, which is (1600,1252) in town. The phone module has no handler for Beatup at all (no grep hit under `src/game/mobile/`).
- **How often.** It starts on its own in town: after the prologue, every ~45 s with a 50% chance (`maybeStart`), and the first one comes after about 4 minutes in town. Every phone player will hit it in Chapter 1 or 2.
- **Repro.** iPhone 14, play Chapter 1 to the end of Wildern, walk around town. Or in town: `__krel.game.scene.getScene("Hub").beatup.start("MIKEY")`, follow the arrow, reach Mikey, then tap the lit circle.
- **Laptop.** Not affected: E/F/SPACE work there. Clicking the circles on a laptop is broken the same way, but keys cover it.
- **Screenshots.** `131.png` (the buttons show [E]/[F]/[SPACE]), `137-beatup-stuck.png`.

### M1 MAJOR: keyboard key names on screen on the phone (not dialogue)
- **HUD.** After Chapter 1's golden juice, the HUD line under the coins reads `⚡ GOLDEN JUICE (T to transform)` in town and at Home for the rest of the run (`101.png`, `104.png`).
- **New-gun toast.** The toast for the first gun reads "NEW GUN: WONK PISTOL … X / GUN swaps back to the Fart Blaster (infinite ammo)." (`68.png`).
- **Beatup buttons.** `[E] [F] [SPACE]` (see B1).
- These are UI or system text, not character lines, so `hint()`/touchWording applies. Laptop must stay as it is.

### M2 MAJOR: the player is hidden under the right-hand buttons at the town's right and bottom edges
- **Cause.** At the world edge the camera clamps (scrollX 1600 = 2560 − 960), so the player walks to the edge of the picture and ends up under USE/ENTER and RIDE.
- **Measured.** At the Krunch Pit and Krelford International corner the player was at CSS (761,288), under the USE button (centre 744,315, about 90 px across). Mikey's chase in the posse event goes exactly there (`125.png`, `126.png`).
- **Dungeons.** In dungeon rooms the same happens at the top. With the "WEAPON CRATE" and "ROOM CLEAR" toasts stacked at top centre (y 5 to 100), the player standing at the exit was hidden under them. I could not see where I was, walked through the exit, and lost the weapon crate (`74.png`, `75.png`).
- **Suggestion (phone only).** Pad the camera bounds by the width of the button cluster, or move toasts away from the player when he is under them.

### M3 MAJOR: the right-hand fight cluster gets crowded and sits on the picture (the user's complaint)
- **Count.** In a normal Wildern room I counted up to 8 round buttons, all usable at that moment (BONGO, the 💨 button, HEAL, WONK!, SLAM, DODGE, SWAP, FIRE), plus OPEN at a crate and the weapon chip.
- **They cover the picture.** BONGO and the 💨 button sit at x≈560 to 620, about 150 to 210 px inside the picture. The player walked underneath BONGO (`64.png`), explosive barrels and pickups sat under BEANS, WONK! and FIRE (`72.png`, `85.png`), and a boss arena pickup was hidden under WONK!.
- **Confusing label.** The 💨 button's word changed from FAIRY to BEANS to IBS!, and the yellow READY slot also showed "IBS!" while the green one did. A first-timer cannot tell what the button does.

### M4 MAJOR: tapping a red "BOMB HERE" circle in front of Wildern uses the school door instead of walking to the circle
- **Repro (2 of 2 taps).** Chapter 1, objective "Plant 4 bombs". Tap the circle in front of the doors (CSS ≈ 505,198, then ≈ 360,282). You get "The doors are chained shut. Mikey's bombs need planting round the outside…" and no walk.
- **Works.** The side circles work by tap. Stepping into a circle with the stick and pressing PLANT works.

### m1 MINOR: toasts stack very tall at the top right
- The facebrook post, objective and "BACK IN KRELFORD" toasts stack to y≈165 of 390 (`117b.png`).
- At 750x340 a single facebrook post covered about a third of the top-right of the town, including the Krezz Arms sign (`s750-12.png`).
- They come back every time you return to town.

### m2 MINOR: NPC speech bubbles collide with the buttons
- Bubbles draw under the RIDE/WALK button, and the text runs through it ("Has anyWALKeacted yet?", `34.png`).
- The interact prompt runs through RIDE ("remat[RIDE]es", `125.png`).
- Busy clusters of bubbles cover the player in the plaza.

### m3 MINOR: wording
- The crate toast says "Tap ACTION to open it", but the button says OPEN.
- The flyover's skip reads "SKIP ▸▸ (tap)".
- The difficulty screen's "3/5 vs the original balance: Damage taken…" line overlaps itself (`06.png`).
- The title's tagline "The craziest universe of all time..." is low contrast over the art.

### m4 MINOR: two SKIP buttons while reading the Dark Autism book
- The phone's `SKIP ▸▸` pill and the game's own red `SKIP ▶▶` show one above the other (`18.png`).

### m5 MINOR: RuneScape woodcutting (Chapter 2 side quest, mandatory) was hard to work out
- **What happened.** CHOP and ROLL are big and work. But the hint only says "Tap a tree (or CHOP)". When you run out of sausage rolls you crawl, and the big ROLL button is sometimes not shown.
- **My result.** I failed 3 times (best 62/99) and did not work out what I was doing wrong. This may be my play, not the phone. Recheck by hand.
- **Smaller issues.** Sanjeev stands half behind the inventory panel. At one point a "SO FAR" log opened over the minigame's end screen.

### m6 MINOR: Chapter 1 dungeon difficulty for a phone first-timer (NORMAL)
- **What happened.** I died 3 times in Wildern. The first was idle time, which is my test's fault. The second and third came in the cafeteria and the boiler-room survival room, holding FIRE and circling.
- **HEAL taps.** 3 HEAL taps made while two other fingers were held (stick and FIRE) did not heal. A single tap later did, and a third-finger BONGO tap did register. Possibly a heal cooldown, so unconfirmed: re-test HEAL with 3 fingers.

### m7 MINOR: bike steering drifts
- **What happened.** With the stick pushed straight up, the bike kept curving sideways (for example "left 0.7 s" moved (−339, +111)). Riding into a building corner left it stuck until I backed out.
- Feels like momentum on purpose, but it is twitchy for a thumb. This is the all-version bike feature, so ordinary game code is allowed for it.

### m8 MINOR: tapping the Old Flat's wall does not enter it
- The player walked part of the way and stopped. Tapping its door worked. Tapping the Town Hall's body did work.

## Checked and not a bug (driver artifacts)

- **TV On Demand drag did not scroll at first.** That happened only while my driver sent touches with `radiusX/radiusY/force`. With plain touch points, like the smoke test uses, a finger drag scrolled the list by 135 px and started nothing (750x340, from the title's WATCH TV).
- **Rhythm game (Do The Crocodile) started by itself.** My script was idle at the time. The required side quest then passed with 0/89 moves, which is a game design note, not a phone note.
- **Town arrow looked reversed.** The yellow arrow glyph `➤` rendered pointing the wrong way in headless Chromium. That is a font fallback here, not a phone issue.

## Works well (do not break)

- **Enter gate and Home Screen guide.** The Enter gate says TAP TO START. The guide's first-run card fits 844x390 and 750x340, and NOT NOW, ✕ and the title button all work.
- **New game.** Character select (tap picks, PLAY AS starts), Difficulty and Banter all work by tap.
- **Conversations.** Tap-advance with typing complete, AUTO, LOG (a clean scrolling log), SKIP with its KEEP READING / SKIP SCENE confirm, the reaction choice with big buttons, and II in meetings.
- **Tap to use at Home.** TV, gun rack, book, console, laptop and posters all work from anywhere: the player walks there. The prompt reads "Tap: …" and the verb button changes (SLEEP, WATCH, PLAY, READ, USE, ENTER, TALK, PLANT, DRINK).
- **TV.** The broadcast's side panel (NEXT LINE, SKIP or NEXT SHOW, ON DEMAND, SWITCH OFF), the paged captions, and the On Demand list with its tabs and ▲▼.
- **Walking and riding.** The stick is responsive, and RIDE/WALK, auto-dismount at doors and the yellow arrow all work.
- **Fights.**
  - HOLD FIRE aims for you and kills well.
  - Buttons show their names in the first fights, then icons only.
  - OPEN appears at crates.
  - WONK!'s tap-anywhere overlay works.
  - IBS, SLAM, the Kreltality ☠ button and the golden juice DRINK button all work.
  - The death screen's retry, the boss bar and the tutorial cards are in touch words.
- **Pause and settings.** The pause menu (two columns, 44+ px rows), the Phone settings page (scrolling card, clear help lines) and DONE/RESUME.
- **Minigames.** RuneScape's CHOP and ROLL buttons, and the Crocodile's three big lane buttons with [ LEAVE ] and II.
- **750x340.** The guide, the town, the TV list and the rhythm game all fit.

## Laptop

None of the findings should touch the laptop. B1's fix and the key-name swaps (M1) must be phone-only. M2 and M3 are phone layout. m7 (bike) is the allowed all-version exception.

## Clean-up

The driver, the dev server (5801) and the throwaway worktree are removed at the end of this run. I did not edit `s4-wt` or the main checkout.

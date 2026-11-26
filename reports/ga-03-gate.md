# ga-03: gate review of branch `game-adds` (Mikey's collect quest out, overworld bike on every version)

Reviewed: scratchpad/game-adds-wt at 4b8355bd (7 commits on 496f1066). Worktree clean, nothing edited by me.
My scripts and logs: scratchpad/mobile/work/ga-review/; screenshots: scratchpad/mobile/shots/ga-review/.
Machine: load average 20 to 80 on 4 CPUs throughout, and the shared memory cgroup OOM-killed chrome-headless
renderers repeatedly (dmesg: "Memory cgroup out of memory: Killed process ... (chrome-headless)"); every
"Target crashed" in my own scripts is one of those kills, not the game (see "Crashes" below).

## Verdict: PASS

Nothing is broken. On the laptop, the only differences are the requested features (the bike, and Mikey's hunt going
away). Each one is proven below. I found three small, non-blocking notes (N1-N3).

## Checks (from this worktree, dev servers 5603 / 5613, stopped afterwards)

- (a) laptop fingerprint: half 1 (shell,front,newgame,hub,meeting,dungeon) 40/40 `DESKTOP FINGERPRINT: OK`;
  half 2 (boss,side,places,minigames,finale,alt) 25/25 `DESKTOP FINGERPRINT: OK`.
- (b) touchlaptop 16/16, ipad 16/16, fire7 16/16 (front,newgame); androidtab 29/29 (front,newgame,hub): all OK.
- (c) desktopInvariants passes (in the full run). It and tests/fingerprints/ were edited only in the one baseline
  commit 4b8355bd, which hard rule 0 allows. The edits are 2 lines: the `bike: Z` key row and the `bike: L3` fixed
  pad row. index.html and main.ts are untouched.
- (d) `npx tsc --noEmit` is clean. `npx vitest run`: 45 files, 567/567.
- (e) phone smoke, main: 429/436. All 7 failures were in combat, side and polish, and all are timing checks under load.
  Re-running combat,side,polish gave 123/124 (only `coyote` failed); re-running side gave 20/21 (`coyote`).
  Phone smoke, ALT: 439/441 (`coyote`, `P2 pit`). Re-running side gave 20/21 (`turning round`), then 20/21 (`coyote`).
  `coyote` fails because sinceGround is 141-221 ms against a 140 ms limit, while the game still gives the first
  jump. The BASE commit 496f1066, on the same machine, failed the same `coyote` check (154 ms) in 1 of 3 side runs.
  The bike code never runs in side rooms or fights: `Controls.bike()` is only called from Hub and Kreddle.
  The `bike` section passed 10/10 in both builds.
- Production builds: main and ALT both built (exit 0, ~3 min each, into a temp folder, deleted).
  No asset file name contains "mobile", same as before.

## 1. Mikey's collect quest (laptop, main build)

- Diff: the whole `lost_property` step is gone from src/content/arcs.ts. That takes its step text and its one pickup
  line, MIKEY "YEEEE. Wot majik. Am a wizard.", because that line only played when you picked up those items.
  No other text file changed any dialogue or story text. The new UI text is only the bike's tip toast, its prompt
  "Ride your bike", the Controls row, and the phone's RIDE/WALK and TOUCH_WORDING rows `bike-on`/`bike-off`
  (phones only). The pizza_trial line "lost everything again ... BOTH bike batteries" stays word for word.
  Nothing anywhere still refers to `lost_property` (grep of src, tests, scripts).
- Fresh save (MIKEY, chapter 2), played through the real doors (mikey.cjs + mikey2.cjs):
  - HOME laptop step plays. The next step is the PUB payphone straight away; nothing of Mikey's spawns at FIELD.
  - PUB step plays. TOWN HALL: the parcel (paid) and the election follow one after the other.
  - HOME: the modulator minigame (forced win), then the Nuclear Option plays and `arc_mikey_done` is set.
  - The Modulator leaves `requiredArcSteps`. Once the chapter's other side quests are done, `dungeonOpen()` no longer
    reports a side-quest lock (only the chapter's own pub beat remains). The payout comes from the generic
    `maybeFinishArc`, which unit tests check (+300).
- Old save sitting on the hunt (pizza_trial done, `arcspot_arc_mikey_lost_property_0/_3` set), saved, page
  reloaded, loaded:
  - It loads on `russian_hackers`, with nothing spawned in town.
  - The pause objective reads "SIDE QUEST ...: The Modulator - The Colonel won't let you back in. Phone some
    'contacts' from the pub payphone."
  - E at the pub carries the story on. No softlock, no dangling marker, no page errors.
  - The leftover flags are ignored and harmless.

## 2. The bike

### Laptop (main; keyboard, fake gamepad; bike.cjs)

- Speed: walk 210 and ride 378 px/s (fake clock), ratio 1.8.
- Collisions: the fountain stops you. The left and bottom map edges hold.
  On the phone run, the Town Hall wall stops the rider at y 520 and he rides back away.
  My first laptop wall probe dropped the rider inside the statue at (1130,760); that was my mistake, not the game's.
- Talking: E next to an NPC from the saddle gets you off, the conversation opens, the bike stands beside you, and
  Z gets you back on.
- TV: the telly from the saddle gets you off and the TV opens. After closing it, you can ride again.
- Pause and saving: Esc while riding keeps you on the bike, as ga-01 says. Saving to slot 1 while riding writes
  nothing about riding (only the `bike_tip` flag). Loading that save puts you on foot with the bike outside Home.
- Cutscene or story moment (`cutscene` flag) while riding: you're off.
- Beat-up: it starts with a conversation, so you're off at once (stricter than ga-01 describes, and fine).
- Chapter change while riding (scene restart): on foot, bike at Home, Z still rides.
- Gamepad L3 (faked standard pad): on, and off again.
- Pub door from the saddle: inside on foot; back out, nothing stuck.
- A bike left in the street goes back to Home once you're 720 px away.
- Kreddle Strip: Z gets on; the left edge holds. E at the Exchange counter gets you off and opens its panel.
- No page errors anywhere.

### Characters

FLENKY, KREZMAR, KREBON, MIKEY, SANMIK (main) and KREBLIS (ALT) were all checked in all four directions in game:
facing, bike frames, the behind/in-front layer order, the west mirror, and scale.
Crops: shots/ga-review/laptop-riders-ingame.png (the first three rows are fake-clock and look right). I also looked
at the builder's sheet of all ten riders (shots/game-adds/riders-all-2x.png): the side view faces the direction of
travel, and the front and back layers are right.

### Phone (phone.cjs, real CDP touch)

Profiles: iPhone 14 844x390 with insets 47/47/21, and Android 740x360. Every check passed on both
(`PHONE BIKE ... OK`):
- The RIDE button shows only out in town. It is 60/55 px, inside the safe area and clear of the ACTION corner.
- A tap gets you on; the button lights and says WALK.
- The stick rides at 378 against 210 walking, and steers all four ways.
- Thumb held on the stick while the other thumb taps WALK, then RIDE 250, 700 and 1500 ms later: off, then on
  again, and the stick keeps steering.
- Town Hall wall: stops you, and you ride away.
- A 30 ms tap on ENTER at the pub door: you're off and through it.
- TALK from the saddle: you're off, the conversation opens and the bike button hides; afterwards it is back, saying
  RIDE.
- Pause from the saddle: the menu shows with no bike button over it.
- Kreddle: RIDE plus the stick rides along. Indoors there is no button. No page errors.
- Screenshots: shots/ga-review/phone-main-*.png.

ALT: the laptop part 2 (bike.cjs on 5613: KREBLIS directions, chapter change, L3, pub door, far bike, Kreddle) was all
OK, and the ALT phone smoke's `bike` section passed 10/10.

## 3. The baseline commit 4b8355bd (laptop differences = the features only)

- One commit holds every baseline change plus the 2 invariants lines. Its message lists the changed states and why.
- I diffed every changed baseline, old against new (fpdiff.py). 94 of 120 differ only by the texture count, object
  counts, Z (key 90) registered in town, objsHash, or the bike sprites (`bike:3` at 606,1392 outside Home).
  The rest are:
  - pause_controls: the new row, and rows 21 px apart.
  - The tablets' pad container n 7 to 9: the hidden 🚲 button.
  - title_with_save, slots_load, and NPC positions on androidtab hub/pause: the same objects moved, plus a different
    random chatter flag in the save.
- Experiment that proves the cause, in a throwaway worktree at 496f1066 (node_modules cp -al, `.vite` cache copied,
  removed afterwards). I added to the old code ONLY the Controls row (the keybinds entry, the PAD_FIXED entry, 21 px
  spacing) and ran the hub chain against the NEW baselines:
  - title_with_save and slots_load matched exactly, apart from the texture count (every text position and save flag
    identical).
  - Every pause page and slots_save differed only by texture count, counts, Z and objsHash.
  - hub and pause differed only by those plus the bike sprite.
  So the moved objects come from the extra Text objects using up Math.random (Phaser's Text UUID), exactly as ga-01
  says.
  The androidtab hub shifts come from the same mechanism (the 🚲 Text). I did not run a separate experiment for that.
- Nothing else on the laptop changed. The fingerprint checks above pass against these baselines, and Mikey's step
  appears in no recorded state.

## Notes (non-blocking)

- N1 (report accuracy): ga-01 says "a shove gets you off" on the Kreddle Strip, but `shove()` does not dismount.
  Measured in main and ALT: after a shove you are still riding, and you ride on normally (not stuck). This is
  harmless; either the report or a one-line dismount in `shove()` could change.
- N2 (cosmetic): the bike layers are placed in `scene.update`, before Arcade's postUpdate moves the avatar. So the
  bike trails the rider by one frame of movement: about 6 px at 60 fps, 12 px at 30 fps. The town shadow already
  had the same one-frame lag before this change. The rider can look like he slides a few pixels forward on the bike
  when he stops.
- N3: `BIKE` goes stale after 250 ms without a frame. On a frame hitch over 250 ms the phone button hides for that
  moment and re-arms (160 ms) when it comes back. I did not see this in any run at ~15-20 fps.

## Crashes (environment)

Several of my long runs died with "Target crashed". dmesg shows the shared memory cgroup OOM-killing chrome-headless
processes (7 kills in ~20 min), with other agents' browsers running at the same time. I checked whether the game
was the cause: re-entering the town 5 times in one page (restart.cjs) gave no crash and steady numbers (heap
102-128 MB, textures ~2585, Hub objects 577 each time, so no sprite leak from the bike).

## Housekeeping

- game-adds-wt: clean, HEAD 4b8355bd, nothing edited.
- Throwaway worktree: removed with `git worktree remove`.
- Servers 5603, 5613 and 5623: stopped. Builds: deleted.
- Scripts and logs: scratchpad/mobile/work/ga-review/.

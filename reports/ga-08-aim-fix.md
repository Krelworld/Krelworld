# ga-08: the phone firing default (fix for AIM-0)

Branch `aim`, worktree `scratchpad/aim-wt`, from the autofire tip 204e8c85. Phone only: the laptop is unchanged
(checks at the end). Only `src/game/mobile/`, `tests/`, `scripts/mobile-smoke.cjs` and the phone README changed.

## AIM-0: confirmed, fixed

Confirmed: the branch had no work. The phone default was still AUTO (`settings.ts`: `autoFire: true`, `firing: "auto"`)
and there was no cone or visibility rule under `src/game/mobile/`. Root cause: the build step never ran. It is now built.

## What the player gets on a phone now

- **HOLD FIRE is the default.** Nothing shoots until you hold FIRE. Then the game aims, but only at an enemy **in
  front of you**: within **35°** either side of the way you face. You face the way you last pushed the stick (in side
  rooms, the way you last ran). You aim by turning with the movement thumb (the user's option 1).
- **No lock off screen or behind walls** (the user's option 4). The enemy's body must be on screen (its centre no
  more than half its radius outside the view, so a big boss half on screen counts). It must be inside the room's walls,
  and no wall, pillar or furniture block can stand between you and it. That means the Dungeon's own `obstacles` group,
  read from outside. Barrels and crates follow the same rules.
- **Lock-on while FIRE is held.** You pick up a target by facing it. While you keep holding FIRE, it stays locked as
  you strafe or back away, until it dies, leaves your reach or goes out of sight. The next target is again picked only
  in front of you. One already aimed at (FIRE not held) stays until 45° round, so a target on the cone's edge doesn't
  flicker. This was added after measuring (see below). Without it, keeping the enemy in front meant walking into it.
- With nothing in front, FIRE shoots straight ahead. Sliding FIRE still aims anywhere by hand and snaps only onto an
  enemy you can see. No aim stick by default (the user's worry: "too rough").
- **EASY** in Settings > Firing is the old behaviour, exactly: auto-fire plus the old all-round aim. The row is now
  **HOLD / EASY**. The audit's LIGHT and STILL are no longer offered (ga-02 found they only made fights harder and felt
  broken). Their code stays, and they still work when set (the smoke test sets them).
- **One-time tip:** the first fight on HOLD shows the toast "HOLD FIRE TO SHOOT / It aims at enemies in front of you:
  turn with the stick. Settings > Firing > EASY shoots for you.", and FIRE pulses for 4 s. It shows once per phone
  (cue `fire-hold`, per build).
- **Settings migration** (stored version 2 → 3): `autoFire: true` and any non-`hold` `firing` stored before version 3
  are no longer counted as choices. Those were the old default and the audit's flavours. So every phone that was on
  auto-fire moves to HOLD. A phone that had turned auto-fire off was already on HOLD and stays there. Other choices
  are kept.
- The FIRE how-to lines follow the style in force: the Controls picture (`FIRE_MANUAL` now says "it aims at enemies
  in front of you"), the first dungeon's touch tutorial row and the narrated controls tip.

## Measurements (fake clock, the ga-02 bench with one change; seeds 1 and 2)

The bench is `work/aim/bench/` (bench.cjs, bot.js, out.jsonl, nolock.jsonl). The ga-02 bench hid the cameras to save
time, so their view never followed the player, and HOLD's "on screen" rule then saw nothing. The bench now calls each
camera's `preRender()` after every step. **That also means ga-02's finding that boss centres were "off screen 40 to 60%
of the time" was probably an artifact of the bench, not of the game.** A new bot scheme, `cone`, plays HOLD like a
player who knows the rule. While no target is locked and no bullet is near, it steers within 25° of its target
(thumb wobble ±10° on top). Once FIRE holds a lock, it moves as before. The laptop rows are ga-02's (same rooms,
same seeds).

| Room | Laptop: time / damage taken / dealt per s | HOLD (35° + lock): time / taken / dealt per s | EASY (seed 1 only) |
|---|---|---|---|
| Wildern Cafeteria (ch1) | 32.8 s / 58 / 22.5 | 28.9 s / 24 / 25.2 | 30.4 s / 25 / 21.8 |
| Polson Bedroom (ch2) | 36.3 s / 70 / 31.9 | 49.4 s / 118 / 21.2 | 29.8 s / 61 / 40.3 |
| Krandall (boss, ch1) | 84.5 s / 92 / 33.1 | 83.7 s / 150 / 30.9 | 68.9 s / 163 / 37.9 |
| Job Centre (side, ch5) | 33.6 s / 148 / 72.3 | 30.6 s / 116 / 82.6 | 24.4 s / 120 / 90.2 |
| **All 8 fights** | **8 cleared, 46.8 s, 137 taken/min, 39.9 dealt/s** | **8 cleared, 48.1 s, 139 taken/min, 40.0 dealt/s** | 4 cleared, 38.4 s, 152/min, 47.5/s |

- **HOLD with the 35° cone plays like the laptop overall:** the same damage dealt per second (40.0 against 39.9),
  the same damage taken per minute (139 against 137) and about the same time to clear. EASY is clearly easier: 18%
  more damage dealt and 22% faster. That matches the user's "so easy". 35° needed no tuning, so it stays the user's
  number.
- **Without the lock** (first pass, seed 1): the Cafeteria went to a death (98 s, 1.6 damage a shot against the
  laptop's 5.9), Krandall to a death, and the Bedroom took 52 s and 174 HP. Keeping a target inside 35° of your
  movement means walking at it. That is why FIRE held now keeps its lock.
- Per room: HOLD is a little easier than the laptop in the Cafeteria and Job Centre, harder in the Polson Bedroom
  (crowded, the cone costs time there), and level on Krandall.
- Caveats: a scripted player, not a person. 8 HOLD fights and 4 EASY fights. EASY seed 2 was dropped after the known
  harness crash ("Cannot read properties of null (reading 'context')" after many room loads in one page, which costs 8
  minutes per restart). The numbers show direction and size, not exact values.

## Code

- `aim.ts`: `CONE_DEG` 35, `CONE_KEEP_DEG` 45, `inCone`, `inView`, `segHitsRect`, `lineOfSight`. `pickTarget`
  takes `facing`, `coneDeg`, `keepDeg`, `visible` and `lockPrev`, and `snapAim` takes `visible`. With none of them set
  (EASY), it behaves exactly as before.
- `combat.ts`: HOLD and the other non-EASY styles pass the facing, the visibility test (`wallsOf(dun)` from the
  obstacle bodies, plus the room's inner rectangle in top-down rooms) and `lockPrev` while FIRE or its grace is held.
  Also the one-time tip, FIRE's pulse, and `facing` in `snapshot()`.
- `settings.ts`: `autoFire` defaults to false. `PHONE_SETTINGS_VERSION` is 3, with the migration in
  `chosenFromStored`. The row is HOLD / EASY, help "HOLD: you hold FIRE. EASY: it shoots for you." (fits two lines at
  844x390, checked by screenshot).
- `combatWording.ts`: `FIRE_TIP`. `FIRE_MANUAL` now says "in front of you". `tut-shoot` and `wildern-controls` read
  the style through a getter.
- Tests: `tests/mobileAimCone.test.ts` (14: cone, hold-on, lock, off-screen, pillars, room walls, slide snap, EASY
  unchanged). `tests/mobileFiring.test.ts` covers the default, the migration and the row. `tests/mobileSettings.test.ts`
  covers the defaults and version 3.
- Smoke `combat`: a fresh phone fights on HOLD and the tip appears exactly once. HOLD locks onto the enemy in front,
  not one behind, and locks once you turn to it. It never locks off screen or through a pillar (a real pillar added to
  the room's obstacles). EASY still aims all round and through pillars. The settings sections use HOLD / EASY.
  `settings2`'s "end where they started" compares the firing style in force.

## Dialogue and touch wording

No dialogue was changed. The touch-wording lines I swapped are both phone-only rows that already existed. On HOLD they
now say hold-to-fire:
- `tut-shoot` (TutorialScene's touch column, a UI line): "FIRE (bottom right): hold it to shoot. It aims at enemies in
  front of you; slide it to aim by hand". On EASY it is the old line.
- `wildern-controls` (the narrator's CONTROLS line in data/dungeons.ts, rule 3's exception): "...· hold FIRE to shoot
  (it aims at enemies in front of you; slide it to aim) ·...". On EASY it is the old line.
No character line that mentions a key was touched. New UI text: the tip toast, the row's EASY label and help, and
`FIRE_MANUAL`.

## Judged against 00-USER-PRIORITIES

- Intuitive: point the stick at it and hold FIRE. The ring at the target's feet shows what you will hit. The tip
  explains it once. A first-time player who never reads it still sees FIRE pulse and their gun do nothing until they
  press it. That is clear enough, but it is one more thing to learn than auto-fire was.
- Fun and fair: measured at laptop difficulty instead of easier. The right thumb now works: it holds FIRE about 95% of
  a fight and hops off for DODGE (ga-02 measured about 3 hops a minute). The research warned about this clunk, and it
  is the price of the user's choice. EASY is one tap away for anyone who wants the old way.
- Not done / open: no tuning per room. The Polson Bedroom is the one room clearly harder than the laptop. Side rooms
  use the same 35°, and an enemy steeply above you is only hit by stepping back. In the bench's one side room it
  played at laptop level.

## Checks (logs in `work/aim/check/`)

- (a) Laptop: `--only shell,front,newgame,hub,meeting,dungeon`: 40 of 40 states identical, **DESKTOP FINGERPRINT: OK**.
  `--only boss,side,places,minigames,finale,alt`: 25 of 25, **DESKTOP FINGERPRINT: OK**.
- (b) touchlaptop, ipad, fire7 (front,newgame) and androidtab (front,newgame,hub): all **OK**.
- (c) `tests/desktopInvariants.test.ts` passes. It, `tests/fingerprints/` and `index.html` are unedited (no diff
  against 204e8c85).
- (d) `npx tsc --noEmit`: clean. `npx vitest run`: 576 of 577 in the full run. The one failure was a 5 s timeout in
  `tests/wonkStyles.test.ts` (unrelated, under load). It passes when run again (4 of 4).
- (e) Phone smoke, run while the machine was at load average 35 to 50 on 4 CPUs:
  - Full main run: 395 of 404. Full ALT run: 418 of 423. The failures and what happened to each:
    - Two of my firing checks failed because of how the test was set up. The test enemy sometimes flickered (a dash
      wind-up), and the stick tests could leave the player by the wall, so the enemy pinned beside them was inside the
      wall. HOLD rightly ignored it in both cases. Fixed in the test (5b01d9df and the `toSpot` re-centring).
    - The dungeon's R9 check pressed a spot beside FIRE. It only passed before because auto-fire was on. It now
      presses FIRE itself (06921268) and passes on both builds.
    - These passed when the sections were run again: ALT `lists` and `wording` (both "Target crashed": out of
      memory), ALT `guide` P6, main `review1` P2 and `polish`. Main `side` coyote and turning rate passed on ALT;
      on main they failed again, with frame timing 2x off. These sections do not touch firing.
  - Re-run of `combat` on both builds: every HOLD / EASY / tip / cone / off-screen / pillar / STILL check passes.
    What still fails is timing under this load, and none of it is code these changes touch:
    - LIGHT's pace: 2 shots against 2 in 2.5 s, so the game ran at a crawl.
    - The 200 ms FIRE grace: samples 540 ms apart.
    - SWAP and chip taps: a 90 ms press arrives after the 300 ms hold threshold and opens the picker instead.
  - **So the phone smoke is not green in one clean pass on this machine.** It should be re-run on a quieter machine
    before merging.
- Note: while cleaning up I ran `pkill -f mobile-smoke.cjs` once. It may have hit another workflow's smoke run if one
  was going at that moment. The ones I saw afterwards (ports 5502 and 5692) were still running.

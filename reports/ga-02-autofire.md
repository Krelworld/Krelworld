# ga-02: does phone auto-fire make dungeons too easy?

Branch `autofire` (worktree `scratchpad/autofire-wt`, from 496f1066). Phone only: the laptop is untouched (checks at the end).

## In plain English

**No: auto-fire does not make the dungeons easier than the laptop overall.** I measured it by having a scripted
player of ordinary skill fight the same rooms with the same random seeds on two setups: the laptop controls (WASD,
a mouse that follows the target with a human lag and wobble, left button held down) and the phone's current default
(stick plus auto-fire). Over 21 paired fights (3 top-down rooms, 2 bosses, 2 side rooms, 3 seeds each):

- The phone took **227** damage a minute and the laptop **229**. The phone dealt **49.6** damage a second and the laptop **50.9**.
  The phone cleared 10 of 21 fights and the laptop 12; the phone died in 11 and the laptop in 9.
- **Easier on the phone:** the early, crowded trash rooms. In the chapter 1 Cafeteria the phone cleared **27% faster** and
  took **58% less damage** (23.7 s against 32.3 s; 22 HP against 52 HP). Perfect aim beats a wobbly mouse when lots of
  small, slow enemies are about.
- **Harder on the phone:** bosses. Krandall took **53% longer** on the phone (126 s against 82 s), with 1 death in 3
  (the laptop had none). The phone also fired only 63% of the time against the laptop's 95%. This is because auto-fire
  only shoots at an enemy whose centre is on screen. A big boss's centre was off screen **40 to 60%** of the time.
- **Neutral:** mid-game rooms (Polson Bedroom: 42.6 s against 36.9 s, 73 HP against 67 HP). The chapter 7 rooms killed the
  scripted player on both setups at the same rate.
- The one real edge auto-fire gives is **aim**. Each shot does 60% more damage on average (62.4 against 38.9), so the phone
  uses **34% less ammo** (53 against 80 rounds a fight). The game never needed the player to aim: in 21 of 21 phone
  fights the thumb never touched FIRE.

**The alternatives.** I built three of them as phone Settings choices (Settings > Firing: AUTO / LIGHT / STILL / HOLD)
and measured them the same way. I also measured a fourth (an aim stick) that the FIRE button already allows:

- **LIGHT** (auto-fire at 60% pace) and **STILL** (Archero: shoots only while you stand still) make the phone much
  *harder* than the laptop. Damage dealt drops 23% and 50%, and the scripted player died in 7 and 8 of 12 fights.
  STILL also fights the game itself: the bullets mean you need to keep moving, and some rooms have a "no standing
  still" decree that punishes you for stopping.
- **HOLD** (hold FIRE and the game aims; Soul Knight's scheme) and **AIM STICK** (hold FIRE and slide to aim; twin-stick)
  play about like the laptop: 53 to 54 damage a second against the laptop's 52. But they keep the right thumb on FIRE
  for **62 to 68%** of each fight. The thumb also has to hop off FIRE **3 to 5 times a minute** to dodge or drink. That
  is the "two thumbs busy" clunk the research warned about.

**Recommendation: keep AUTO as the default.** It is not too easy. It is the least clunky option, because one thumb does
everything and the right thumb is free for DODGE, SPECIAL and READY. Ship **Firing: AUTO / HOLD** (HOLD for players who
want to pull the trigger themselves) and drop LIGHT and STILL before release: they only make the phone harder and feel
worse. The default is not changed in this branch (AUTO stays). The coordinator asks the user.

One optional follow-up, not built: let auto-fire shoot a boss when any part of its body is on screen, not only its
centre. That would bring boss fights up to laptop level. It makes bosses easier, not harder, so it is the user's call.

## How firing works (read from the code)

| | Laptop (unchanged) | Phone today (AUTO) |
|---|---|---|
| Aim | the mouse cursor (`Controls.aim`); the 1500-coin bank perk Auto-Aim locks onto the nearest enemy within 520 px | `aim.ts`: nearest enemy within 520 on screen, stick-biased, sticky, in the gun's range first; slide FIRE to aim by hand (15° snap) |
| Fire | hold left mouse / J: fires the gun in hand (or the Fart Blaster) whenever its cooldown is up, whatever is in front | by itself, only at an enemy in the gun's own range whose centre is on screen, never through a barrel by your feet, never at crates or barrels; FIRE held fires regardless |
| Ammo | one round per shot (pellets free), auto-switch when dry; the Fart Blaster is infinite | the same: same guns, same cooldowns, same ammo per shot |
| "Don't hold the trigger" decree | holding 2.5 s adds risk | auto-fire lets go 160 ms every 2 s |

## How I measured

- `scratchpad/mobile/work/autofire/bench.cjs` + `bot.js`: Playwright on a fake clock (60 steps a second, nothing drawn).
  The laptop profile is 1280x720. The phone profile is an iPhone 14 in landscape (844x390, touch, mobile UA). It is
  the real game: real rooms, the real phone layer and the real settings. The random number generator is seeded per run,
  so seed N is the same fight (the same room twist) on every scheme.
- **One brain, different hands.** The scripted player moves the same way on every scheme. It goes for the nearest enemy,
  keeps 150 to 320 px away (70% of the gun's range), strafes and swaps direction every 2 to 4 s, keeps out of
  touching range, and side-steps bullets heading at it. It also dodges half of the close calls, after a 0.18 to
  0.26 s reaction, and drinks juice under 35% health. It uses no specials, WONK or IBS on any scheme.
  - Laptop hands: 8-way WASD; a cursor that follows the target with a 120 ms lag, a 16 px wobble and a 220 ms reaction to
    a new target; the button held whenever an enemy is within 620 px (a typical player holds it).
  - Phone hands: an analogue stick with a ±10° thumb wobble and 85 to 100% push. AUTO / LIGHT / STILL leave FIRE alone.
    HOLD and AIM STICK keep FIRE held whenever an enemy is on screen; a dodge or a drink lifts the thumb off FIRE for
    130 ms each way (the 200 ms grace covers part of it). AIM STICK also slides FIRE toward the target with a ±12° wobble.
    STILL stops when nothing is coming at it and its target is in range (0.7 to 1.6 s), then moves again.
- Rooms (each chapter's own kit: the everyday guns from earlier chapters at full ammo; no bank guns. The chapter 7 rooms
  add the same armour, health and damage perks on every scheme, or the player died in seconds):
  Wildern Cafeteria (ch1), Polson Bedroom (ch2), Citadel Foyer (ch7); the bosses Krandall (ch1) and Drongus 1 (ch7);
  the side rooms Job Centre (ch5) and Crobley Factory Floor (ch4).
- Runs: laptop and AUTO, 3 seeds x 7 rooms. LIGHT / STILL / HOLD, 2 seeds x 6 rooms. AIM STICK, 2 seeds x 5 rooms (no
  slide-aim in side rooms). "AUTO without phone assist", 2 seeds x 3 rooms. 128 fights in all.
- Caveats. A scripted player is not a person. It never uses specials, so bosses are long and the chapter 7 fights
  mostly end in death on every scheme (compare damage rates there, not clears). The Crobley Factory Floor fights end in
  pits on every scheme (the bot's platforming), so I count only its combat damage. Two seeds is a small sample for the
  alternatives. The numbers show the size and direction of each difference, not exact values.

## Laptop against phone AUTO (3 seeds each)

| Room | Scheme | cleared / died | time to clear (s) | combat damage taken | per min | ammo used | kills | damage per shot | boss HP left | firing % of fight |
|---|---|---|---|---|---|---|---|---|---|---|
| Wildern Cafeteria (ch1) | laptop | 3 / 0 | 32.3 | 52 | 96 | 0 | 14.7 | 5.4 | - | 89 |
| | AUTO | 3 / 0 | **23.7** | **22** | 54 | 0 | 14.7 | 9.5 | - | 74 |
| Polson Bedroom (ch2) | laptop | 3 / 0 | 36.9 | 67 | 109 | 326 | 35.0 | 3.5 | - | 82 |
| | AUTO | 3 / 0 | 42.6 | 73 | 101 | 246 | 32.3 | 4.2 | - | 56 |
| Citadel Foyer (ch7) | laptop | 0 / 3 | - | 277 | 432 | 59 | 7.7 | 69.1 | - | 88 |
| | AUTO | 0 / 3 | - | 258 | 466 | 38 | 5.7 | 84.1 | - | 64 |
| Krandall (boss, ch1) | laptop | 3 / 0 | 82.0 | 124 | 92 | 0 | 18.3 | 8.1 | 0.00 | 95 |
| | AUTO | 2 / 1 | **125.6** | 180 | 81 | 0 | 24.3 | 8.5 | 0.14 | 63 |
| Drongus 1 (boss, ch7) | laptop | 0 / 3 | - | 270 | 271 | 132 | 10.0 | 41.4 | 0.81 | 94 |
| | AUTO | 0 / 3 | - | 270 | 332 | 49 | 5.7 | 56.8 | 0.83 | 69 |
| Job Centre (side, ch5) | laptop | 3 / 0 | 30.8 | 132 | 265 | 23 | 33.0 | 105.8 | - | 48 |
| | AUTO | 2 / 1 | 31.4 | 108 | 218 | 12 | 32.7 | 219.1 | - | 32 |
| Crobley Factory Floor (side, ch4) | laptop | 0 / 3 | - | 107 | 339 | 22 | 17.7 | 39.0 | - | 78 |
| | AUTO | 0 / 3 | - | 124 | 337 | 25 | 24.3 | 54.5 | - | 74 |

| Group | Scheme | cleared | died | damage taken / min | damage dealt / s | damage per shot | ammo per fight |
|---|---|---|---|---|---|---|---|
| top-down rooms (9) | laptop | 6 | 3 | 212 | 45.5 | 26.0 | 129 |
| | AUTO | 6 | 3 | 207 | 42.8 | 32.6 | 95 |
| bosses (6) | laptop | 3 | 3 | 181 | 47.6 | 24.8 | 66 |
| | AUTO | 2 | 4 | 207 | 37.1 | 32.6 | 25 |
| side rooms (6) | laptop | 3 | 3 | 302 | 62.2 | 72.4 | 22 |
| | AUTO | 2 | 4 | 278 | 72.1 | 136.8 | 19 |
| **all (21)** | laptop | 12 | 9 | 229 | 50.9 | 38.9 | 80 |
| | **AUTO** | 10 | 11 | 227 | 49.6 | 62.4 | 53 |

The Krezz, fart and WONK meters filled the same on both setups. Krezz grew 51 to 60 a fight on both. The WONK meter
was full in almost every fight on both. The fart meter grew 54 against 54 in the Cafeteria and 100 against 100 in the
Bedroom; it ran slightly lower on the phone in the long fights (it fills by hitting, and the phone fires less often). No
fight needed aiming on the phone: FIRE was never touched in 21 of 21 AUTO fights.

A good laptop player (cursor lag 60 ms, wobble 8 px) was measured once, before the machine got too loaded: Cafeteria
seed 1, 32.5 s and 81 HP, the same as the typical laptop player. Mouse precision is not what makes the phone easier
in the Cafeteria; aiming that never misses a slow crowd is.

## The alternatives (seeds 1 and 2, the six rooms without the Crobley pits)

| Firing | fights | cleared | died | damage taken / min | damage dealt / s | damage per shot | ammo per fight | right thumb on FIRE | thumb hops off FIRE / min |
|---|---|---|---|---|---|---|---|---|---|
| laptop | 12 | 8 | 4 | 212 | 51.6 | 38.4 | 92 | (finger on the mouse button) | - |
| **AUTO** (default) | 12 | 7 | 5 | 231 | 49.8 | 63.3 | 56 | 0% | 0 |
| LIGHT (60% pace) | 12 | 5 | 7 | 305 | 39.3 | 77.6 | 40 | 0% | 0 |
| STILL (Archero) | 12 | 2 | 8 | 256 | 25.7 | 72.5 | 17 | 0% | 0 |
| HOLD (Soul Knight) | 12 | 6 | 6 | 257 | 53.2 | 55.1 | 65 | 62% | 3.3 |
| AIM STICK (hold + slide) | 10 | 5 | 5 | 205 | 54.1 | 41.2 | 78 | 68% | 5.4 |
| AUTO, phone assist off (top-down only; AUTO on the same 6: 253 / 46.2) | 6 | 3 | 3 | 334 | 35.2 | 29.1 | 79 | 0% | 0 |

Per room (the full table is in `work/autofire/summary.md`). STILL cleared 0 of 6 top-down fights: the Cafeteria went
to a death and a timeout (the scripted player stood still and got hit). LIGHT took 41.9 s in the Cafeteria, against
AUTO's 23.7 s. No style beat Krandall in 2 tries: Krandall had 16% HP left with AIM STICK, 38% with HOLD, 65% with
LIGHT and 91% with STILL. AUTO beat him 2 times in 3.

**Feel, by touch** (a real-touch pass, `work/autofire/feel.cjs`, iPhone landscape, Polson Towers, 12 s per style:
stick circling, a DODGE every 3 s):

- **AUTO.** One thumb plays. The right thumb only touches DODGE (3 touches in 12 s). FIRE glows while the game shoots.
  Calm and readable.
- **LIGHT.** The same hands, but shots come in sparse bursts: about 0.6 of AUTO's pace by construction, measured at
  0.56 to 0.75 in the smoke test. It reads as "my gun is broken", not as "this is harder". The only fix is to hold
  FIRE, which is HOLD with extra steps.
- **STILL.** Shots only in the rests. 7 shots in 12 s against AUTO's 24. You have to stop in bullet patterns to shoot,
  which is the opposite of what the dodge-heavy rooms ask of you. It also clashes with the "no standing still"
  decree (standing still for 0.9 s adds risk).
- **HOLD.** The right thumb sits on FIRE (2.3 s held in 12 s with a hop every 3 s). Every DODGE means lifting it, then
  finding FIRE again: 6 right-thumb touches against AUTO's 3. SPECIAL and READY have the same problem. It works and it
  feels deliberate, but it is the clunk the research warned about (M1, point 2).
- **AIM STICK.** HOLD plus a slide: the most control, and the most thumb work (5.4 hops a minute). Snapping (15°) makes
  it forgiving, but your thumb covers the lower-right sixth of the picture all the time.

Why LIGHT and STILL can't be fixed by tuning: their only lever is shooting less, so the player gets weaker at the moment
they are paying the most attention to dodging. That is not "harder but fair". HOLD and AIM STICK make the player work
for the same result. AUTO is the only scheme that frees a thumb.

## What I built (phone only)

| Commit | What changed for the player |
|---|---|
| `1f3f9c7c` | Settings > Firing: one row, **AUTO** (default, exactly the stage 2 behaviour) / **LIGHT** / **STILL** / **HOLD**. It replaces the Auto-fire toggle; HOLD is auto-fire off, and a phone that turned auto-fire off in stage 2 reads as HOLD. FIRE by hand (hold, slide to aim) works the same in every style. The Controls picture's FIRE line follows the style. |
| `0e010d09` | README: the Firing styles. |
| `204e8c85` | The Firing row's help line fits in two lines. |

- Code: `settings.ts` (`firing`, `FireStyle`, `fireStyle()`, the row keeps `autoFire` in step), `combatLogic.ts`
  (`AutoPace`, `StillGate`, `LIGHT_PACE` 0.6, `STILL_MS` 120, `STILL_STICK` 0.2), `combat.ts`
  (`autoShooting` / `firing` in `snapshot()`; LIGHT's pace and STILL's gate applied after the AUTO rules; the 200 ms
  FIRE grace for every style but AUTO), `combatWording.ts` (`fireLine`, `FIRE_LIGHT`, `FIRE_STILL`; `controlsPicture.ts`
  re-exports them).
- Tests: `tests/mobileFiring.test.ts` (9 tests: defaults, legacy auto-fire off, cleaning, the row's get/set, the FIRE
  lines, LIGHT's pace over a minute, STILL's gate). `tests/mobileSettings.test.ts` adjusted: a new default key, and
  autoFire has no row of its own.
- Smoke: the `combat` section now checks LIGHT's pace (0.45 to 0.78 of AUTO's at the same pinned enemy), that held FIRE
  in LIGHT goes at full pace, that STILL shoots nothing while the stick is pushed and shoots once it rests, and that
  HOLD shoots nothing by itself. The `settings` / `settings2` / `together` sections use the Firing row in place of the
  old toggle.
- If the user picks AUTO / HOLD only: delete the `light` and `still` options from the row's `options` (the code paths
  can stay or go; nothing else depends on them).

Dialogue: nothing changed. Touch wording: no line was swapped. The new UI text is the Firing row (label, help, option
words) and two Controls-picture lines (`FIRE_LIGHT`, `FIRE_STILL`).

## Other findings

- **The boss "on screen" rule** (see above): with Krandall and Drongus, the boss's centre was off the phone's view 40
  to 60% of the time while the scripted player kept a sensible distance. Auto-fire (margin 0) and the auto-aim target
  (margin 16 px) both wait it out. That is why AUTO is weaker on bosses than the laptop. A fix is a one-line change in
  `autoFireOk` / `pickTarget`: count a target as on screen if any of its radius is. It is not built: it changes
  AUTO's difficulty.
- **Phone assist is a real help too.** On the same three top-down rooms and seeds, AUTO with phone assist off took 334
  damage a minute and cleared 3 of 6, against 253 and 4 of 6 with it on (6 fights each: a small sample). The kinder
  dodge window and the pickup magnet count for about as much as the aim does.
- **A possible memory lead (harness only so far):** after about 10 room loads in one page, new Phaser Text objects
  failed with `Cannot read properties of null (reading 'context')` (stack: `new Text` ← `Citadel.pa` /
  `DialogueBox.lineCount`). It happened 4 times in about 75 phone runs, each after many scene stops and starts in one
  page, and never on a fresh page. It looks like canvas memory running out (iOS caps canvas memory). It is worth a look
  by whoever owns phone memory, with a long real session on a device.

## Checks

See the end of this file (filled in when the full check finished).

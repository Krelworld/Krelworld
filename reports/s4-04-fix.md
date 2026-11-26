# s4-04: stage 4 fixer, round 1

Branch `s4` in `scratchpad/s4-wt`, from live 8b337a45. Commits (oldest first):

| Commit | What the player gets |
|---|---|
| 84317f1b | Posse fight by touch, Back never leaves, Wonk-Off ready card, no key names, calmer fight cluster, toasts, town camera, bomb tap, Pit board, Beep Beep speedo, save list, Whack line, pit margin, LIGHT check retired |
| 3376065d | Bike (all versions): a Kreddle shove dismounts; the bike no longer trails the rider in town. Phones: the bike steers straight |
| 7bae6775 | Wonk-Off card pauses at once; smoke checks for the town corner, toast cap, save list, Beep Beep speedo |
| cef77fa9 | Brawl buttons see-through over the player, no corner SKIP FIGHT; home-screen pause menu without FULLSCREEN; SanMik toast wording |
| 1d8d82a6 | Hints name the button's verb (FREE, OPEN); RuneScape re-up glows when low; Difficulty notes and title tagline |
| 10bb577f | `src/game/mobile/README.md` "Stage 4: the phone QA's fixes" |
| 2c6a8df3 | BONGO only steps aside while HEAL is red (HEAL shows at any damage); smoke checks follow the calmer cluster; HEAL check made robust |

All phone work is in `src/game/mobile/` (new: `posse.ts`, `qaFixes.ts`, `qaLogic.ts`) or a guarded hook:
`BeepBeepScene.ts` (speedo x, `isMobile() ? W - 290 : W - 92`), `PitScene.ts` (row height / count), `MenuScene.ts`
(FULLSCREEN row dropped when `isMobile() && phoneOnHomeScreen()`), `systems/bike.ts` (`snappy = isMobile()`).
Bike nits (hard rule 0) in `KreddleScene.shove`, `HubScene.makeBike` (POST_UPDATE follow) and `gfx/Bike.ts follow()`:
both act only while riding, so no laptop baseline changed (see the check below; nothing re-recorded).

## Findings

| Id | Action | What / why |
|---|---|---|
| B1 posse softlock | fixed | `posse.ts`: tap mode with SHOVE (left thumb), PUNCH, KICK (right), the wanted one glows, canvas circles and [E]/[F]/[SPACE] hidden, II = pause menu over town (the town's own Esc path is shut while busy). No timeout added: with working buttons the fight always ends (14 hits + KICK). Smoke: 15 taps, 15 landed, won; II opens the menu. |
| M1 key names | fixed | HUD chip → "(GOLD in a fight)" (watched on `UIScene.statT` only), new-gun toast → SWAP wording. Beatup keys gone with B1. |
| M2 player under buttons / toasts | fixed | Town camera bounds +240 x +130 game px on the buttons' side (measured: player at the map corner, nothing over him). Toasts: at most 2, and 22% opacity while the player is under one. |
| M3 crowded cluster | fixed (partly) | 💨 always FART; BONGO hidden while HEAL is red (under 40%); buttons see-through over barrels and pickups. Not done: moving the pocket out of the picture (no free slot on a 390 px screen without shrinking the main buttons). Max at once is now 7 round buttons (was 8). |
| M4 bomb circle → school door | fixed | `GROUND_SPOT` spots are not grown to the building behind them, so the small circle wins the tap. |
| m1 toast stack | fixed | Two at most (smoke: 4 emitted, 2 shown). |
| m2 bubbles through RIDE/USE | deferred | The interact prompt already turns overlapping buttons see-through; NPC chatter bubbles are flavour text drawn in the world. Moving them needs a per-bubble re-layout in Hub/Club; not cheap. |
| m3 wording/layout | fixed | Crate toasts name OPEN; flyover skip "SKIP ▸▸"; Difficulty multipliers line dropped on phones (it re-wrapped into itself; the cards say it in words); tagline outlined. |
| m4 two SKIPs (book) | fixed | The conversation's SKIP pill steps aside while the book's own SKIP (which also stops the voice) shows. |
| m5 RuneScape | fixed (partly) | Re-up button glows below 35 gear (where the game's own orb turns yellow). It is hidden at 85+ by design (the game refuses a re-up then). No hint text added. |
| m6 HEAL with 3 fingers | rejected | Not reproduced: s4-03 ran the HEAL-under-load check 2/2 green; HEAL also hides during the game's no-heal window (`noHealUntil`), the likely cause. |
| m7 bike drift | fixed (phones) | `bikeVelocity(..., snappy)`: sideways drift dies in ~45 ms; laptop numbers unchanged (unit test). |
| m8 Old Flat wall tap | deferred | Not reproduced here; its door tap works. Needs the building's collider vs door spot gap measured (`standsOn` 60 px). |
| late-F1 narrator legends | fixed | Rows for the factory / plane / Cuddle Tower / colon legends, plus "When you krezz (R)" and two golden-juice tips found by the new scan test (`tests/mobileNarratorKeys.test.ts`, fails on any narrator line left naming a key). |
| late-F2 PRESS D | fixed | "💊  TAP HERE" (cockpit), "💊  TAP TO TAKE DRUGS" (town), "(or tap the button)" removed. Any-tap-takes-it not added (the pill now says so). |
| late-F3 / platform-F1 Back twice | fixed | Back on the pause menu = RESUME; Back never leaves. Smoke: Back, Back, Back in town = pause, resume, pause, same URL. |
| late-F4 finale mash | fixed | "tap tap tap". |
| late-F5 brawl corner skip | fixed (brawl) / deferred (Roof, Lair) | Brawl's corner SKIP FIGHT hidden (II card has it). Roof/Lair keep both: the corner skips the whole cutscene, the pill only the conversation. |
| late-F6 ACTION verb | fixed | INJECT for lads, OPEN for the staff toilet, FREE for Untie; no hint says ACTION. |
| late-F7 gun rack | fixed | "Tap a gun to see". |
| late-F8 brawl under buttons | fixed | Brawl feeds the fighter into `layer.occluders`. |
| late-F9 / P12 Beep Beep | fixed | Speedo and MPH at x = W - 290 on phones; smoke checks they clear BOOST, BRAKE, HORN. |
| platform-F2 / P9 Wonk-Off | fixed | Club paused under "WONK-OFF / Tap to start" (fresh tap, 650 ms arm); II while it runs. |
| platform-F3 / P7 Pit board | fixed | Rows 74 px, 5 shown on phones. The opening narration still covers the lower board while it runs (it goes after). |
| platform-F4 / P6 Whack | fixed | Rules line split before "NEW HIGH SCORE" (same words). |
| platform-F5 home-screen FULLSCREEN | fixed | Row gone when running from the home screen; installed state sticky for the visit. |
| platform-F6 Kreddle shove | fixed | dismount at the start of `shove()`. |
| platform-F7 bike trails rider | fixed | `follow()` on the Hub's POST_UPDATE. |
| platform-F8 iOS 16 silent | deferred | The only known fallback is a looping silent `<audio>` element, which puts KRELWORLD on the iPhone lock screen as "Now Playing"; the brief said not to ship that. Added to DEVICE_CHECKLIST.md so a real iOS 16 phone answers it. |
| platform-F9 save list BACK | fixed | Rows close up 10 px each (84 px tall); smoke: last row ends at 432, BACK top 445. |
| platform-F10 TV Back | fixed | Back = the TV's Esc (switch off / whatever's on). |
| platform-F11 LIGHT pace check | fixed (retired) | LIGHT is not offered in Settings; the 2.5 s window counted 0-3 shots. AutoPace stays unit-tested. The held-FIRE LIGHT check stays. |
| platform-F12 / P2 pit put-back | fixed | `PIT_MARGIN` 140 (the label's promise had 98-109 px measured). The check's threshold is unchanged. |

Known items not in the findings:
- **P11** load rows under 🗑: s4-03 measured it fixed; no change.
- **Flaky checks** (side coyote, SWAP/chip, HEAL tap): s4-03 ran each 2/2 green under load 3; no cause found in the test or the game, no change (see the full run below).
- **TV-from-Hub memory**: rejected for phones: s4-03's iPhone-profile walk peaked at 771-806 MB renderer RSS, the same as TV from Home; the 2.6-3.7 GB was the old headless path, not what a phone sees.
- **Bike button flicker**: rejected: five 400 ms stalls while riding, WALK shown in 39 of 39 samples (s4-03).

## Lines swapped on phones (rule 3)

UI / system text (hint / wordText; laptop unchanged): `⚡ GOLDEN JUICE (T to transform)`; the new-gun toast's
`X / GUN swaps back to the Fart Blaster` and `X / GUN cycles weapons.`; `💊  PRESS  D  TO TAKE DRUGS`, `(or tap the
button)`, `💊  PRESS  D`; `any key · click · tap`; `Press V any time to become SanMik (and back).`; the crate toasts
(`Press E to open it.`, `Walk over and press E.`); `Inject each of the lads (walk up, press E)`; the hostage hint and tag
(now FREE); the flyover's `(Space / Esc / tap)`.

Narrator only (dialogue box, `dir` / NARRATOR lines): data/dungeons.ts:147, :389, :980, :1012 and :830 (`When you krezz
(R)`); DungeonScene.ts:3160 and :3269 (golden juice); HomeScene.ts:223 (`Point at a gun`); content/bosses.ts:531 (the
Cronster TIP now says FREE). Character lines that mention a key: none new; the list in s2-04 (riffs.ts:377, :410,
drongusStatuses.ts:27, :81, chapters.ts:298, ch7.ts:19, citadel.ts:112) is unchanged and untouched.

## Honest judgement

A first-time phone player can now get through the posse event, the Wonk-Off and the Back gesture without a reload,
and no screen should name a key. The fight cluster is calmer but still busy at its peak (7 buttons when everything is
ready); the town's edge now shows a dark band past the map, which reads fine but is plain. iOS 16 silent mode and NPC
chatter bubbles under the buttons remain open.

## Checks (dev servers from this worktree: main :5861, ALT :5871)

- (a) Laptop: `--only shell,front,newgame,hub,meeting,dungeon`: 40 of 40 states identical, DESKTOP FINGERPRINT: OK.
  `--only boss,side,places,minigames,finale,alt`: 25 of 25 identical, OK. No baseline re-recorded (the bike fixes act
  only while riding; no laptop state rides).
- (b) touchlaptop 16/16, ipad 16/16, fire7 16/16, androidtab 29/29: all OK.
- (c) `tests/desktopInvariants.test.ts` 19/19; it, `tests/fingerprints/` and `index.html` unedited (`git diff 8b337a45`
  empty for them).
- (d) `npx tsc --noEmit` clean; `npx vitest run` 698/698 (55 files; new: `mobileS4.test.ts`, `mobileNarratorKeys.test.ts`).
- (e) Phone smoke, full: main 654 of 664 and ALT 666 of 668 on the first pass. Every failure was a check still
  expecting the old cluster (CABBAGE, BONGO beside a red HEAL: 8 polish + 1 wave2 on main, 2 polish on ALT, which
  had the updated checks) plus HEAL on main (the room-clear top-up landing between "10 HP" and the tap; fixed in the
  test). After 2c6a8df3 (a phone-only change: BONGO hides only while HEAL is red) the affected sections were run
  again on both builds: `--only combat,polish,wave2` main 130/130, ALT 130/130. The new `s4` section passed in the
  full main and ALT runs (17 of 17 checks each). The rest of the full runs (every other section) passed on both builds,
  including review1 P2 (pit), side coyote, SWAP / chip, and the Back check in the phone section.
- Load during the runs: 3 to 7 (other agents running).

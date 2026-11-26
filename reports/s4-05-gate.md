# s4-05: stage 4 gate, round 1

Branch `s4` at **2c6a8df3** (7 commits on live 8b337a45), in `scratchpad/s4-wt`. Nothing was committed there. I ran
everything from a throwaway worktree of s4 (`mobile/work/s4gate/wt`, detached at 2c6a8df3), plus a second throwaway
worktree at live 8b337a45 to check what was already true before s4. Both are removed now. The s4-wt worktree is clean.

## Verdict: PASS

The laptop is unchanged. No dialogue changed. Every claimed fix I re-ran is fixed on the profiles the fixer tested.
Both phone smokes are fully green, and both production builds succeed. Three small layout leftovers remain on the
750x340 profile (iPhone Safari with its bars showing). One of them was already there on live. None of them blocks
play, and none touches the laptop (N1 to N3 below).

## The full CHECK (dev servers from the throwaway worktree: main :5881, ALT :5891)

| Check | Result |
|---|---|
| (a) `--only shell,front,newgame,hub,meeting,dungeon` | 40 of 40 states identical, **DESKTOP FINGERPRINT: OK** (404 s) |
| (a) `--only boss,side,places,minigames,finale,alt` | 25 of 25 identical, **OK** (475 s) |
| (b) touchlaptop / ipad / fire7, `front,newgame` | 16/16, 16/16, 16/16, all **OK** |
| (b) androidtab, `front,newgame,hub` | 29/29 **OK** |
| (c) `tests/desktopInvariants.test.ts` | 19/19. `git diff 8b337a45 s4` is empty for index.html, src/main.ts, vite.config.ts, tests/fingerprints/, tests/desktopInvariants.test.ts, package*.json and variant.ts |
| (d) `npx tsc --noEmit` | clean |
| (d) `npx vitest run` | 55 files, 698/698 |
| (e) phone smoke, main | **668 of 668**, MOBILE SMOKE: OK (3281 s, load 5 to 7) |
| (e) phone smoke, ALT | **668 of 668**, MOBILE SMOKE: OK (2789 s) |
| Production build, main | OK in 15 s. The posse and qaFixes code is only in the lazy phone chunk (`index-B2…js`); the entry chunk is `index-D88…js` |
| Production build, ALT | OK in 16 s |

Both build folders were deleted as soon as each build finished. No baseline was re-recorded, and s4 has no
baseline commit. The bike fixes did not move any laptop state, because no fingerprint state rides the bike.

## The diff outside src/game/mobile/, tests/ and scripts/ (each hunk checked)

| File | Hunk | Verdict |
|---|---|---|
| scenes/BeepBeepScene.ts | `isMobile() ? W - 290 : W - 92` for the MPH text and the dial's x | guarded phone hook |
| scenes/PitScene.ts | `RH = isMobile() ? 74 : 62`, `VIS = isMobile() ? 5 : 6`; imports `mobile/flag` | guarded phone hook |
| scenes/MenuScene.ts | `if (isMobile() && phoneOnHomeScreen()) items.splice(5, 1)`. Index 5 is the FULLSCREEN / ADD TO HOME SCREEN row (RESUME, QUESTS, LOG, CONTROLS, SETTINGS come first). `phoneOnHomeScreen` is in boot.ts, returns false unless isMobile(), and imports nothing new | guarded phone hook |
| systems/bike.ts | `bikeVelocity(..., snappy = isMobile())`; the old code path is unchanged when snappy is false; imports `mobile/flag` | guarded phone hook (bike) |
| gfx/Bike.ts | new `follow(rider)`: returns unless riding | bike fix (all versions) |
| scenes/HubScene.ts | POST_UPDATE listener calling `bike.follow(av)` | bike fix (all versions; does nothing unless riding) |
| scenes/KreddleScene.ts | `shove()`: `if (this.bike?.riding) this.bike.dismount(this.me)` | bike fix (all versions) |

No other game file imports anything from `mobile/` except `flag` and `boot`.

## Dialogue (hard rule 3)

- src/data, src/content, public and every scene file: no changed `say` / `dir` / `talk` / `t:` / `s:` string
  (script-compared over the whole diff outside mobile/: zero matching lines).
- The only text change inside mobile/ that touches a game object is Whack's rules line (`splitWhackRules`). It swaps the
  `" · "` before "NEW HIGH SCORE" for a line break and keeps every word. Verified live on the page:
  `"...(max 25)\nNEW HIGH SCORE +3 🎟 · 8000+: 250 KREZZCOIN"`.
- I checked the source of each new wording rule (`COMBAT_NARRATOR_TIPS`, `NARRATOR_TIPS`, `TOUCH_WORDING`,
  `COMBAT_WORDING_FIRST`). Each one is a NARRATOR line or a `dir()` line (data/dungeons.ts:147, :389, :830, :980, :1012;
  DungeonScene.ts:3160, :3269; HomeScene.ts:223; content/bosses.ts:531) or UI / system text (UIScene chip, DungeonScene
  toasts, hub/drugs.ts, VignetteScene pill, FinaleScene mash hint, the SanMik toast, FB_INJECT_HINT toast). No
  character line was swapped. The fixer's list (s4-04 "Lines swapped on phones") matches what I found.

## The fixes re-run (my own script `mobile/work/s4gate/gate.cjs`, real touches, plus the smoke's own checks)

| Fix | Profile(s) | Result |
|---|---|---|
| B1 posse fight | 750x340 (smoke: 844x390) | SHOVE, PUNCH, KICK and II are all on screen with no overlap. II opens the menu, 4 s paused, then RESUME by tap: still `fight`, the buttons come back, the fight's clock did not run. Back pauses and Back again resumes; the page is never left. Smoke: 15 of 15 taps landed and the fight was won. **Fixed** |
| R3 / late-F3 / platform-F1 Back | Android 740x360 in a Wildern fight; town (smoke) | Back pauses, Back resumes with the combat controls back, Back pauses again. Same URL. **Fixed** |
| platform-F5 home-screen FULLSCREEN | iPhone with `navigator.standalone` | The pause menu has neither FULLSCREEN nor ADD TO HOME SCREEN, and every other row is there. In a Safari tab it still offers ADD TO HOME SCREEN. Main and ALT. **Fixed** |
| P12 / late-F9 Beep Beep speedo | 740x360, 932x430 (smoke: 844x390) | The dial and MPH clear BOOST, BRAKE, HORN, FIRE and II. **Fixed** |
| P7 Pit board | 844x390: clean. 750x340: see N3 | **Fixed** (a 3 px nit left at 750x340; live spilled 15 px into the next row's title) |
| P6 Whack card | 740x360 and 844x390 clean, rules line split. 750x340: see N1 | **Fixed at 740 and 844; not at 750x340 (already so on live)** |
| platform-F9 save list | 740x360 clean (save and load). 750x340: see N2 | **Fixed** (BACK no longer covers SLOT 3; live overlapped it by 32 game px) |
| platform-F6 Kreddle shove | iPhone and laptop | Riding, then `shove()`: off the bike, on both. Live 8b337a45 stays riding on both. **Fixed** |
| platform-F7 bike trails rider | laptop | 40 frames at about 378 px/s: the bike layers sit 0 px from the rider's feet every frame. Live trailed by 17 to 25 px. **Fixed** |
| m7 bike steering | laptop | `bikeVelocity(...)` with the default gives the same numbers as `snappy=false` on a laptop. The unit test covers phones |
| P9 Wonk-Off card, F10 TV Back, M1 chip, M2 town corner, m1 toast cap, F11 LIGHT retired, F12 pit margin, HEAL race | smoke `s4`, `combat`, `polish`, `review1`, `wave2` | All green on main and ALT. The retired LIGHT check is honest: LIGHT is not offered in Settings, AutoPace is still unit-tested, and the held-FIRE LIGHT check stays. PIT_MARGIN went up, but the check's threshold is unchanged. |
| Flaky checks (pit P2, side coyote, SWAP/chip, HEAL) | full smoke, both builds | All passed on the first run, with no re-run needed |

The smoke's removed checks are each intentional: "Back while the pause menu shows leaves the game" (now the
opposite), the LIGHT pace ratio (retired), and CABBAGE in the fart button (the button now always says FART). The
pocket-button check was rewritten for BONGO hiding while HEAL is red. No real requirement was loosened.

## Remaining findings (none blocks the gate)

**N1 (minor, already on live; P6 not closed at 750x340).** At 750x340 (iPhone Safari with the bars showing),
Whack-a-Drongus's card still collides: "GOLDEN CROBLEY: THE GREAT TAP" runs into its "x2!", and the "Hit five in a
row..." paragraph runs out of the card's bottom ("...back to" is cut). Live 8b337a45 measures exactly the same
(same overlap, same overflow). The s4 change (the rules-line split) neither helps nor hurts this. It is clean at
740x360 and 844x390, which is where s4-03 measured. Screenshot: `mobile/shots/s4gate/whack-safari.png`.
Suggestion: on phones, shrink the card's right-column text or let the paragraph wrap one line shorter. Laptop: no.

**N2 (minor, a side effect of F9 at 750x340).** The save and load lists at 750x340: the rows are now 84 px, and the
AUTO row's fourth line ("Difficulty 3/5 · ⏱ 0:00 · 💰 0") sits on SLOT 1's top border and is half covered by it
when SLOT 1 is picked. SLOT 3 also ends exactly at BACK's top, with a 0 px gap; the smoke asks for 4 px on the
iPhone profile. This is still a net gain over live, where BACK covered 32 px of SLOT 3. Screenshot:
`mobile/shots/s4gate/slots-save-safari.png`. Suggestion: 86 to 88 px rows, or a smaller AUTO meta line on phones.
Laptop: no.

**N3 (nit, 750x340).** On the Krunch Pit board, the second line of each description touches its row's bottom border
(3 game px). Live spilled 15 px into the next row's title. Screenshot: `mobile/shots/s4gate/pit-safari.png`.

Still open, as the fixer reported: the deferred m2 (NPC chatter bubbles under the buttons; visible in
`posse-safari.png`, where a bubble sits under PUNCH), m8, the iOS 16 silent fallback, and the Roof/Lair double skip.

## Housekeeping

- My first throwaway worktree copied s4-wt's `node_modules` symlink as a relative link, so it was broken. My first
  `npx vite` then began fetching vite@8.4.0 into the npx cache (`~/.npm/_npx/9ed0…`, 37 MB, partial). I stopped it
  within seconds and deleted that cache folder. The project's node_modules (a symlink to mobile-wt's) was never
  touched, and no package was installed into any project. All runs used the repo's vite 6.4.1.
- Dev servers stopped. Throwaway worktrees removed. Builds deleted. 13 screenshots in `mobile/shots/s4gate/`. Logs
  and the repro script are in `mobile/work/s4gate/`.

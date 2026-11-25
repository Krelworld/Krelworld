# Stage 2 re-check after the thumb-feel round

I did not write this code. I checked branch `mobile-feel` at **0c3be3ca** (`git log 37a710d4..HEAD`: f78fb1a5, 03c91610, 77e2dfe3,
35872aca, 0c3be3ca) in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-feel-wt`. I ran my own dev servers
(normal on 5222, ALT on 5232) and my own touch scripts (real CDP touch, iPhone 14 at 844x390 with insets 47/47/21, and Android at 740x360).
I made **no commits**. The worktree is clean, the servers are stopped, and nothing was pushed.

**Verdict: the laptop is unchanged, and the user's four complaints are fixed. One phone-only blocker remains.** At FART level 3, the 💨 button's
word **CABBAGE does not fit inside its round button at any phone size**. The button clips it to "ABBAG". This also makes the ALT phone smoke
fail one check (426 of 427). The fix is a design choice (font size against the readability floor), so it is not a one-line fix I can be
certain of. I left it for the builder (B1 below).

## 1. The user's four complaints, checked by real touch

| Complaint | Result | Evidence (my scripts; logs in `.../mobile/work/recheck/`) |
|---|---|---|
| **Stick "slides all over the screen"** | **Fixed** | Thumb lands at (140, 290) and is dragged 240 px right and 40 px up: the base stays at exactly (140, 290) and gives full speed (mx 1.0). Moving back past the base gives full left (mx -1.0). The stick thumb slid on across the screen onto JUMP: **no jump**, still full speed right. Lift = stop (mx 0). Same at 740x360. Top-down rooms (2-D stick): a 230 px diagonal drag leaves the base where it was, at full speed. A touch that starts in the middle of the screen (outside the zone `x 0..380`) starts no stick. (`feel844.log`, `feel740.log`) |
| **Jumping "a little awkward"** | **Fixed: immediate and forgiving** | A real 20 ms tap while standing under every reachable 127 to 135 px platform **lands on it**: 3 of 3 at 844x390, 3 of 3 at 740x360. Rise was 128 to 157 px. Under this machine's load (8 to 14 on 4 CPUs, roughly 12 to 20 fps), a quick tap reads close to a full jump. That only makes the jump more forgiving. Running with the stick held plus a quick JUMP tap 10 to 140 px before a 135 px platform's edge: **lands on it every time** (4 of 4 at each size). Two taps give a jump and then a double jump. Buffer: a press about 12 px before landing, with both jumps used, fires on landing (`kind: first`). Walking off a one-way platform's edge drops straight away, 30 px down within 143 to 167 ms of leaving it. I checked this because the new one-way `ledgePop` rule could have held the player at the edge, and it does not. (`side2-844c.log`, `side2-740.log`) |
| **Specials "tiny to press"** | **Fixed** | Full kit at 844x390: 💨 and 🍺 are 60x60 drawn with 100x100 touch areas, HEAL is 56 (96), SANMIK is 60 (100). At 740x360: 55 / 52 drawn, 95 / 92 touch. All are on the right half. Tapped by touch: 🍺 drank a bongo (2 to 1), HEAL drank juice (hp 81 to 126, bottles 2 to 1), 💨 released the fart (meter 60 to 34 or 5). **Nothing unusable is shown.** At full hp with no bongo and an empty meter there is no HEAL, 🍺 or 💨, and SPECIAL shows only when `specialReady`. |
| **"Is there a pause button?"** | **Yes, everywhere I looked** | II at the top right: 52 px drawn with a 72x68 touch area (62x66 at 740). It shows in the side room, top-down rooms (Flenky and Mikey) and the Hub. Tapping it by touch opens the pause menu (`Menu` active, Dungeon paused), and RESUME returns to `side:Dungeon`. The smoke covers the brawl and the boss rooms (all passing). |

**Overlaps:** No button covers another button, caption, word or the HUD. I measured the side-room start, the busiest side screen (pocket, HEAL,
SPECIAL), the calm and full top-down rooms (Flenky, and Mikey with SANMIK) and the Hub, at both sizes. The one exception is B1.

## 2. Findings

### B1 (blocker, phone only): "CABBAGE" spills out of the 💨 pocket button
- `.kt-pocket .kt-in` is a fixed 10 px font. At FART level 3 the word is 57.7 px wide (55.6 with letter-spacing 0). The button face is
  60 px at 844x390, 55.4 px at 740x360 and 52.3 px at 750x340.
- The round face clips the word. It reads **"ABBAG"** at 750x340 and **"'ABBAG!"** at 844x390, the user's own iPhone size. Screenshots:
  `750x340-cabbage-zoom.png`, `844x390-cabbage-zoom.png`. FAIRY, BEANS and BONGO fit at every size.
- The ALT smoke's `polish safari-bars 750x340 room-mid` check failed on this ("word c-fart:CABBAGE outside its button"). It happened there
  because the meter crossed 75 during the 1.5 s wait. The normal-build run stayed at BEANS and passed, so the check is a real catch that
  only fires some of the time.
- This is not a one-line certain fix. A smaller font goes under the 10 to 11 px readability floor. Fitting the width alone still cuts into
  the circle, because the word sits below the centre. Options for the builder:
  - show the level as pips (●●●) or a number instead of the word;
  - use a shorter phone-only label such as "CABB." or "LV3";
  - give 7-letter words a condensed style with a smaller font.

  After the fix, the smoke's polish section should force level 3 so the check stops depending on luck.

### Notes (not blockers)
- **N1. Reversing with the "stays" stick.** After the thumb drifts far past the rim, reversing takes a long thumb move back across the base.
  I measured that it works (mx -1 once the thumb is about 40 px left of the base). On a real phone in stage 4, it is worth comparing STAYS
  against FOLLOWS (FOLLOWS is now kept inside the zone) as the default.
- **N2. Reach.** Centre to centre from FIRE (the resting right thumb), 844x390: HEAL 166 px, 💨 204, 🍺 264, SANMIK 292. At 740x360: 153 / 188 / 243.
  SANMIK sits near the middle of the screen (x 481 to 541 at 844). All are reachable, but 🍺 and SANMIK are a stretch. This matches the
  builder's own note; check on a real phone in stage 4.
- **N3. Variable jump height under load.** With this machine at roughly 12 to 20 fps, a 20 ms tap rose 128 to 157 px, which is nearly a
  full jump. The builder measured 122 to 123 at a lighter load. Either way it lands on the standard platforms, so the variable height never
  costs a landing. On a real 60 fps phone the tap should give the designed ~126 px.
- **N4. Wording swaps checked against the dialogue rule.** The four changed phone swaps are:
  - Tutorial rows (TutorialScene's `touch ? "💨 button" ...` rows): "💨 pops up on the right once it's charged.", "HEAL pops up on the right
    when you're hurt.", "🍺 pops up on the right when you have one."
  - Dungeon toast (`DungeonScene.ts:3903`, a system toast): "Tap IBS! (on the right) to unleash it."

  All are UI or system text, no character line is touched, and the laptop lines are unchanged.
- **N5. Gaps in my own script, fixed before the results above.** A few of my first-pass failures in `feel844.log` and `feel740.log` came from
  my script, not the game:
  - the side snapshot keeps only the last 6 jumps, so counting by length was wrong;
  - one platform (x 1114) sits behind the room's lock;
  - CDP `touchEnd` lists the points that *end*.

  `side2.cjs` fixes all three, and every result in section 1 comes from the fixed runs. The first-pass "idle ring off the player" check
  measured a 0x0 element. I checked it in the screenshots instead (`*-side-start.png`): the ring sits above the player, not on him.

## 3. The full check

| Check | Result |
|---|---|
| (a) fingerprint `shell,front,newgame,hub,meeting,dungeon` (main + ALT) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** (`fp1.log`) |
| (a) fingerprint `boss,side,places,minigames,finale,alt` | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** (`fp2.log`) |
| (b) touchlaptop / ipad / fire7 (`front,newgame`) | 16 of 16 each, **OK** |
| (b) androidtab (`front,newgame,hub`) | 29 of 29, **OK** |
| (c) `tests/desktopInvariants.test.ts` | 19 of 19 |
| `git diff origin/claude/krelworld-game -- tests/fingerprints index.html tests/desktopInvariants.test.ts` | **empty** (also `src/main.ts`). Every file changed since 37a710d4 is under `src/game/mobile/`, `tests/mobile*` or `scripts/mobile-smoke.cjs` |
| (d) `npx tsc --noEmit` / `npx vitest run` | clean / 44 files, 553 of 553 |
| (e) `mobile-smoke.cjs` normal (5222) | **427 of 427, MOBILE SMOKE: OK** (`smoke-normal.log`, 1680 s) |
| (e) `mobile-smoke.cjs` ALT (5232) | **426 of 427, FAILED**: only B1 (`smoke-alt.log`). The builder's ALT "P2 pit" failure did not show up this time |
| Production builds, main and ALT | Both built (`vite build`, temp folder, deleted afterwards). Served with `vite preview`. **Laptop boot never requested the phone chunk** (main `index-CvbVXcTm.js`, ALT `index-61MuXB02.js`; no `html.mobile`). The iPhone control run did fetch it. **PRODBOOT: OK** for both |

## 4. Screenshots (1x, 20 files)
All are in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-recheck/`:
- `844x390-*` and `740x360-*`: `side-start`, `side-busy`, `side-paused`, `FLENKY-room-calm/full`, `MIKEY-room-calm/full` (844 only), `hub`, `hub-paused`;
- `750x340-cabbage-*` and `844x390-cabbage-*`: B1.

## 5. How to speed this up (the user asked)
This re-check took about 2.5 hours on a shared machine (load 8 to 14 on 4 CPUs). Almost all of that was browser runs: the full phone smoke is
about 28 minutes per build, the two fingerprint halves about 19 minutes, the four device profiles about 10, and every page boot 15 to 60 s.
Ways to cut it without losing safety:
1. **Gate the laptop fingerprint on the diff.** If `git diff --name-only` touches only `src/game/mobile/` (outside `boot.ts`/`flag.ts`),
   `tests/mobile*` or `scripts/mobile-smoke.cjs`, then the production "laptop never fetches the phone chunk" check plus
   `desktopInvariants.test.ts` already prove the laptop is unchanged. This round met that condition. That saves about 30 minutes a round.
2. **Run only the smoke sections a change touches** (`--only side,combat,polish` for a controls change). Keep one full run per stage gate.
   Phone mode has no ALT differences, so a gate could run the full smoke on one build and a short `--only phone,combat,side,polish` on the other.
3. **Don't run two agents' browser suites at the same time.** At load 12 the pages run at roughly 12 to 20 fps. That caused the builder's
   timing flakes (coyote, camera, the ALT pit check) and the re-runs that followed.
4. **Make the smoke's pocket check deterministic** (force a FART level) so a check that passes or fails by chance doesn't cost another run.
5. **Get one real iPhone session in early.** The remaining questions (stick default, reach to 🍺 and SANMIK, tap height at 60 fps) can only be
   settled there, and emulation rounds cannot answer them however many times they run.

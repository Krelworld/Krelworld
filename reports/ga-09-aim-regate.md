# ga-09: re-gate of the phone firing default (branch `aim`, head fa62432f)

Worktree `scratchpad/aim-wt`, read-only. Servers 5647 (main) and 5657 (ALT). Logs and the probe script are in
`scratchpad/mobile/work/aim-regate/`. Screenshots are in `scratchpad/mobile/shots/aim-regate/`.

## AIM-0 (branch had no work): FIXED, confirmed by touch

- 7 commits on top of 204e8c85. They change only `src/game/mobile/` (aim.ts, combat.ts, settings.ts, combatWording.ts,
  README), `tests/mobile*` and `scripts/mobile-smoke.cjs`. Compared with the merge base 496f1066, no file outside
  those paths differs.
- `settings.ts`: `autoFire: false`, so HOLD is the default. The Firing row offers HOLD / EASY. `PHONE_SETTINGS_VERSION` is 3.
  `chosenFromStored` drops `autoFire: true` and any `firing` other than hold stored before v3, so phones that were on
  AUTO now get HOLD.
- `aim.ts`: `CONE_DEG = 35` and `CONE_KEEP_DEG = 45`, plus `inView` (the enemy's body on screen, within half its
  radius), `lineOfSight` (Liang-Barsky against the Dungeon's `obstacles` bodies, plus the room's inner rectangle) and
  `inCone`. `combat.ts` sends facing, visibility and lockPrev for every style except "auto" (EASY), and EASY keeps the
  old all-round aim.
- One-time tip: the cue `fire-hold` shows a toast and makes FIRE pulse for 4 s.
- Phone smoke (main), all passing: a fresh phone is on HOLD; the tip "HOLD FIRE TO SHOOT" shows once; no shots
  without a thumb on FIRE; the aim locks onto the enemy in front and not the one behind; turning toward an enemy locks
  on; no lock off screen; no lock through a pillar; EASY still aims all round. The unit tests mobileAimCone,
  mobileFiring and mobileSettings pass (60 tests together with desktopInvariants).
- Judgement call: while FIRE is held, the lock stays on the target outside the 35° cone as you strafe. The user
  asked for 35°; this relaxes it. The fixer measured it, and HOLD plays like the laptop (40.0 damage dealt per second
  against 39.9). Without the lock the Cafeteria ended in death. It is documented in ga-08. It is not a blocker, but
  the user should hear about it.

## Checks

| Check | Result |
|---|---|
| (a) fingerprint, shell,front,newgame,hub,meeting,dungeon | 40/40, **DESKTOP FINGERPRINT: OK** |
| (a) fingerprint, boss,side,places,minigames,finale,alt | 25/25, **DESKTOP FINGERPRINT: OK** |
| (b) touchlaptop / fire7 / androidtab | OK / OK / OK |
| (b) ipad | First run: "front" never reached the Enter gate within 240 s, a boot timeout under load. Rerun: 16/16, **OK** |
| (c) desktopInvariants | passes. No diff to it, to tests/fingerprints/ or to index.html |
| (d) tsc | clean |
| (d) vitest | 575/577. Two 5 s timeouts under load: content "no slurs" and wonkStyles "styled zones". Both pass with a longer timeout. Neither file is touched by this branch |
| (e) phone smoke, main | **431/439, FAILED** |
| (e) phone smoke, ALT | **436/440, FAILED** |

Load average during the runs: 18 to 41 on 4 CPUs.

## Smoke failures

Timing only. These checks are flaky under load, the ga-08 report has the same ones, and the branch does not touch
their code:
- LIGHT pace (both builds).
- SWAP tap and chip tap (the press arrives late and becomes a hold).
- HEAL tap and "after the wonk" (only in the ALT rerun).
- Side coyote and turning rate (main).
- REVIEW1 P2 pit (ALT, twice; it passed on main).
- PHONE "welcome conversation shows nothing" (main; the second read of the mode differed).
- WORDING "Target crashed" (main).

Test assumption, no game bug: in the ALT full run, the HOLD off-screen check locked onto **barrel b2**. It sat on
screen at 34° in front (aim 0.6 rad), which the design allows, and it was not the off-screen enemy. This check passed
in the ALT rerun and on main. The test could exclude objects.

**Real, phone-only, pre-existing: the shielded boss's name runs over KREZZ / WONK and under the weapon chip (AIM-1).**
- The smoke check that catches it: TOGETHER "boss fight, text size normal/large: the boss's name and bar clear of the
  KREZZ / WONK lines". It failed in the full main run (normal size) and in the main rerun (large size).
- Cause:
  - This branch changed `together` to choose EASY instead of HOLD (commit f2110384). The following Krandall fight now
    auto-fires, and the boss reaches a shield phase.
  - `UIScene` then sets `bossT` to "KRANKY KRANDALL  [SHIELDED 0/3 - KILL THE MINIONS]" (or "[VULNERABLE!]"). The text
    is about 410 to 515 px wide and is centred on the phone boss bar.
  - Its bounds become x 319 to 833. They cross the KREZZ / WONK text (x 300 to 395) and run under the weapon chip on
    the right.
- Screenshots: `shots/aim-regate/boss-shield-normal.png` and `boss-shield-large.png`, taken with `work/aim-regate/bossname.cjs`.
- `UIScene.ts` is identical on live 0da900db, so live phones show this on every shielded phase. It is not caused by
  the HOLD change, which if anything makes it rarer.
- Fix: phone-only, in the phone path (`phoneFight()`). Fit `bossT` inside the bar: use a shorter tag such as
  "[SHIELD 0/3]" (this is UI text, not dialogue), or scale or crop the text to `bb.w`. Then re-run the `together` section.

## Verdict

AIM-0 is fixed and the laptop is unchanged. The gate does **not** pass cleanly, for two reasons:
- the phone smoke is not green;
- AIM-1 is real, phone-only and pre-existing; the branch's test change made it visible, and the fix is small.

Every other failure is timing under load. Re-run the smoke on a quieter machine.

Not in this gate's scope: the user's other complaint ("no sound effects in dungeon") needs its own check.

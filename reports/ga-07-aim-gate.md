# ga-07 Gate: phone firing default (branch "aim") - FAIL, nothing to review

Plain English: the builder for the new phone firing default left no work behind. Branch "aim" is
exactly the "autofire" tip (204e8c85): no commits, no uncommitted changes, no report ga-05-aim.md,
nothing in mobile/work/aim/ or mobile/shots/aim/. On it, the phone default is still AUTO fire
(src/game/mobile/settings.ts: `firing: "auto"` at lines 70 and 152), and there is no 35-degree cone
or off-screen/behind-wall rule anywhere under src/game/mobile/. So the user's complaint
("both auto firing and auto aiming. It was so easy") is NOT fixed on this branch.

What was checked
- `git diff --stat 204e8c85 HEAD` in aim-wt: empty. `git status`: clean. Reflog: only "reset: moving to HEAD".
- grep for a cone / aim-assist change under src/game/mobile: none.

Not run (pointless on an unchanged branch; the autofire tip was gated by its own round):
touch play, bench re-runs, desktop fingerprint halves, device profiles, tsc, vitest, phone smoke,
production builds. No servers were started; no files in aim-wt were touched.

Needed: re-run the "PHONE FIRING, THE USER'S CHOSEN DEFAULT" build step (hold FIRE by default,
assist only within ~35 degrees of facing, no lock off screen or behind walls, old auto-fire as an
EASY choice, one-time tip, settings migration), then gate again.

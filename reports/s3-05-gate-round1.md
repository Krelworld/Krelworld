# Stage 3 wave 1, final gate, round 1 (branch s3-tap)

Worktree `scratchpad/s3-tap-wt`, head **c24ee0d1** (18 commits since 37a710d4). I edited no game code and made no commits.
The worktree is clean. My servers (5307 / 5317) and the temporary base server (5327) are stopped. The throwaway
37a710d4 worktree is removed. The production builds were deleted.

**Verdict: PASS.** Non-phone devices are provably unchanged, and I found no blocker for a phone player. Every failure
in the runs below is either the machine (renderers OOM-killed by the shared memory cgroup) or pre-existing: it
reproduces on 37a710d4 and is in code this branch does not touch.

## 1. Laptop and the devices next to a phone

| Check | Result |
|---|---|
| (a) fingerprint, first half (shell, front, newgame, hub, meeting, dungeon) | 40 of 40 identical, DESKTOP FINGERPRINT: OK |
| (a) second half (boss, side, places, minigames, finale, alt) | 25 of 25 identical, DESKTOP FINGERPRINT: OK |
| (b) touchlaptop, ipad, fire7 (front, newgame) | 16 / 16 / 16 identical, all OK |
| (b) androidtab (front, newgame, hub) | 29 of 29 identical, OK |
| (c) `tests/desktopInvariants.test.ts` | 19 passed. It, `tests/fingerprints/`, index.html, main.ts and vite.config.ts have no diff since 37a710d4 |
| (d) `tsc --noEmit` / `vitest run` | clean / 47 files, 591 tests passed |
| Changed lines outside `src/game/mobile/` | `KrelfordFinale.ts`: the flag import and two `isMobile() ? 1 : 0.8` zoom ternaries (guarded). Everything else is tooling or tests: `scripts/mobile-smoke.cjs`, `tests/mobile*.test.ts` |
| 3-minute laptop play, base 37a710d4 vs head | Fixed-clock harness (`scratch s3-gate1/laptop-play.cjs`) through Enter, title, character select, new game, Home walk, the telly, pause, Hub walk and pause, the Krezz Arms (Pub) walk, the Club, the Exchange shop, a Wildern room with walking and firing, and pause. **17 of 17 screenshots byte-identical.** 2,967 requests in each. The request sets are identical except vite's own `env.mjs` path (the base worktree's node_modules was a symlink). Only `boot.ts` and `flag.ts` are fetched from the phone folder. No console errors |
| Production builds | main and ALT both build. In a laptop boot of each, only the entry chunk is fetched (main `index-B8IZZSNH.js`, ALT `index-cRIhgzyt.js`), with no modulepreload. The phone chunk (`index-abbfCXo0.js`, 297 KB) is fetched only by the iPhone profile. `?mobile=1` on a laptop still loads only the entry chunk |

## 2. Phone (real touch events)

| Check | Result |
|---|---|
| Smoke ALT, full | **522 of 525.** The three failures are the side-room jump checks (JUMP on touch-down, tap-vs-hold hop height, coyote). These are real-time timing checks in side.ts / jump code, which this branch does not touch. On 37a710d4 the coyote and hop-height checks fail the same way (two `--only side` runs on base) |
| Smoke main, full | 370 of 383 at load 25-40. Three other agents were running browsers, and the shared memory cgroup (14.3 GB) OOM-killed renderers 6 times (dmesg). Failed or crashed sections were rerun: |
| reruns, main | `platform,phone` **94/94** (machine quieter). `lists,together,review1,polish` 119/120: only P2 (the pit), which fails on 37a710d4 too and belongs to mobile-feel. `tapfix` 21/21 and `mix3` 18/18. `combat` **46/46** (SWAP tap and the weapon chip pass). `side` 18/19: only coyote, which also fails on base |
| Tap to use, 740x360 Android | Home: a tap on the telly from 740 px away walks there and opens KrelTV. Hub: a tap on GRONNY G walks there and the conversation opens. Club: a tap on the stage walks there and tips the dancer. Kreddle: the bridge with no coins starts the Pit Boss scene, a tap on a KREDDLER walks there, and the smoke's own Kreddle and arcade-frontage checks pass. No page errors |
| Lock / unlock, iPhone 14, insets 47/47/21 (`Emulation.setSafeAreaInsetsOverride`) | Mid tap-walk: while hidden, the loop sleeps and the sound context suspends. Shown again: the context is running, the song plays, the stick reads 0/0, and the player can walk on. Mid-minigame (Whack): coming back shows the pause menu, with Whack held and the context running. RESUME by tap brings Whack back with its song. The smoke also checks Minigame (menu) and the finale (PAUSED card) |
| 17-stop texture walk (iPhone) | Home, TV, Hub, Pub, Club, Kreddle, Venue, Minigame, Whack, BeepBeep, Meeting, Wildern, the Hoard, Crobley factory, the finale brawl, the concept boss, then Home again. **Peak 346 MB** (concept boss; ceiling 500). Boot 309 MB. 0 failed fetches. No page errors |
| Dungeon fight / side room | Covered by the `combat` (46/46) and `side` reruns. The fight, tap-to-use and pause routes all work |
| `?mobile=0` on the iPhone profile | No `mobile` class, no layer, no phone CSS, no `__krelMobile`. Only `flag.ts` and `boot.ts` are fetched from the phone folder. The smoke's `optout` and `desktop` sections also pass |

## 3. Findings (none blocks the publish)

1. **Environment, not the branch: renderer memory spike when the TV starts over the Hub.** The smoke's platform
   section crashed several times right after it starts `TV` from the Hub. I measured the renderer every 0.5 s. With TV
   started from the Hub, it peaked at 2.6-2.8 GB on the iPhone profile, on the head and on **37a710d4 alike**. On the
   *laptop* profile on 37a710d4 it peaked at 3.7 GB and the renderer crashed. So this is the game's own TV-over-Hub
   path in headless software GL, not phone code. With TV started from Home there was no spike (renderer ~700 MB).
   For a like-for-like flow (title, Home, Hub, TV, Kreddle, dungeon), the process tree used about 2.1 GB on the head
   against 2.3 GB on the base. The head's GPU process is 800 MB against 1,280 MB on the base. Stage 4 should watch
   TV-over-Hub on a real iPhone.
2. **Pre-existing (DEFERRED R3 follow-up):** in town, Back opens the pause menu, and a second Back with no touch in
   between leaves the page. This reproduces on 37a710d4. It is why the smoke's `phone` section can fail. On a loaded
   machine, the welcome conversation starts about 1 s after the check, so the check's two Backs land in walk mode.
   It passes on a quiet machine (94/94 above).
3. **Pre-existing:** P2 (the pit) and the side jump timing checks fail on base too. They belong with mobile-feel.
4. **Nit (rule 6):** merge commit 45903eb5's message ends with git's `# Conflicts:` comment block *after* the two
   footer lines. The footer lines are present, but they are not the last lines. All 17 other commits end exactly with
   the two lines. If the strict reading matters, rewording that merge message needs a history rewrite. Leave it or
   reword it before pushing.
5. **Nit:** the offline art copy uses CacheStorage name `krel-art-<manifest hash>`, not `storageKey()`. Rule 4 is
   about localStorage keys. Both builds share one art manifest, so on a shared origin they share the same copy of the
   same files. This is harmless.

No model name or email in any diff line or commit message (checked by grep). No dialogue or story file changed. The
only text change is Whack's rule line on phones: newline to space, same words.

## Scratch

Scripts and logs are in `scratchpad/mobile/work/s3-gate1/`: `laptop-play.cjs`, `phone-gate.cjs`, `rss*.cjs`,
`probe-*.cjs`, `smoke-*.log`, `fp*.log` and `prof-*.log`. Screenshots (12) are in `scratchpad/mobile/shots/s3-gate1/`.

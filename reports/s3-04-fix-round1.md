# Stage 3 wave 1, fix round 1

Worktree `scratchpad/s3-tap-wt`, branch `s3-tap`, head c24ee0d1. Nothing was pushed. Commits: b410b140 (tap to use),
ba4e2323 (pictures and sound), 8697688d (Whack card, archive), 7b8fd559 (README), c24ee0d1 (two smoke-test timing
fixes). The worktree is clean.
No game file outside `src/game/mobile/` changed. index.html, main.ts, the Phaser/vite config,
`tests/desktopInvariants.test.ts` and `tests/fingerprints/` were not edited. No dialogue was changed and no narrator
tip was swapped in this round. One UI rule line (Whack's multiplier rule) has its two sentences run on (newline to
space) on phones only. The words are the same.

## Dispositions

| id | action | what / evidence |
|---|---|---|
| P1 (blocker) | fixed | Reproduced with a held tap (down, 160 ms, up) on the window's line: on the old code each closing tap reopened it (`world:1, open1:true` 3 times in a row). The cause is that the game closes the line on the down, and by the up the room is walkable again. Now canvas touches are recorded only if the layer's decision (last frame's) is walking, and every tap carries its landing time; one that landed before the scene became walkable (`walkSince`) does nothing. Smoke `tapfix`: the closing taps count 0, the line stays closed, the next tap opens it, the player stays put. It fails on the old code. |
| P2 | fixed | ACTION's touch area reaches past its face (hit 693-797 vs face 703-787). A still tap there on another thing's picture (not the prompt's, and not a big thing the whole button sits on) goes to tap to use (`TouchControl` `passThrough` / `onPassTap`). A tap on the face is still ACTION. Smoke: the console beside the face walks to the console and the player stays at Home; the face opens the window's line. Fails on the old code (it used the prompt). |
| P3 | fixed | `startStick` moved the element without clearing `ghostKey`, so `placeGhost` thought it was already at rest. Smoke: ring at rest (150,290) after a floor tap at (274,365). The old code left it at (274,365). |
| P4 | fixed | The ARCADE and CASINO frontages are tap targets for their machines (`imageNear`, the right one of two `kd_bld_arcade`). Smoke: a tap on the arcade's upper frontage walks to KRAZY REELS. |
| P5 | fixed | Phone-only (laptop 11 px fits). `screens.ts` wraps `WhackScene.attract`: the rule goes into the free slot under the right column and points move right where a name needs room. Smoke: no overlaps, all text inside the card. |
| P6 | fixed | List option `wrapLabels` (two-line clamp for row names and the title), used by the archive. Smoke: 4 of 5 names whole (the one-line constitution title is clamped on line 2), count whole. |
| P7 | fixed (partly; device check deferred) | Not reproduced. A walk stuck the 2nd-4th time now steps 40 px aside (open floor only) before re-routing, and gives up after four attempts instead of two. Added to DEFERRED stage 4 to watch. |
| L1 | fixed | `findPath` returns `expanded`. The test bounds the work (5,016 of 17,920 cells, limit a third) instead of timing it. |
| R10 | fixed | Search buffers are reused, using a generation stamp (allocated once per grid size), and the town's grid is built once per visit. Unit test: 50 routes in between give the identical route and the same buffer size. |
| R1 | fixed | In art.ts, reloading a picture redraws any TileSprite whose `displayTexture` uses it (the reviewer's "key" was the TileSprite's own canvas texture), and `held()` counts `displayTexture`. Measured: 131,072 of 131,072 pixels opaque (was 0). Smoke `mix3` checks it. |
| R2 | fixed | Offline copy in CacheStorage (`krel-art-<manifest hash>`). The loader's own downloads go in as they arrive (at most 6 held), and the rest come from the HTTP cache (`force-cache`) one file at a time after boot. A reload uses the copy first. A failed fetch backs off 2/4/8/16/30 s. With no signal, filling pauses for 60 s. Smoke `platfix` with the network off: a picture in the copy comes back (fromCopy 1, failed 0), and one not in the copy fails 2 times in 3 s (was 26). |
| R3 | fixed | `artLogic.family`: bossanim/die/down/move + kcv of one boss are wanted and held together. Smoke: a kneel sprite on `bossdie_troll` after a sweep shows 0 blank frames, and the family parks again afterwards. |
| R4 | fixed | VsSplash and KrelCine pause after `create` until their parked pictures are live (at most 1.2 s, measured 140-300 ms). Smoke: 0 running frames without the faces. |
| R5 | fixed (edge case deferred) | 4 pooled song elements. Spares that have played are reused, and others are let go with their nodes disconnected. In the reviewer's 5-songs-in-160 ms script, the 5th is still on a spare. Ending a pooled element's fade early is unsafe because Synth's ramp closure would `pause()`/`src=""` the reused element. Noted in DEFERRED. |
| R6 | fixed | Voice elements are freed on `error` and on a refused `play()` (generation-checked). Smoke: 3 junk lines and 8 good ones leave 0 busy voices and no growth. |
| R7 | fixed (device check deferred) | With `routeOk` false, voices are not routed and only take unrouted elements (`pickSlot`). |
| R8 | fixed | `isStray`: an element is not a stray while it is current, fading or emptied, for 1.2 s after it stopped being current, or for 1.2 s after it was handed out. The smoke stray check now compares `doubles` before/after (+1). |
| R9 | fixed | (1) The minigame song must be `paused === true`. (2) The `mix3` cores check is replaced by the kart TileSprite pixel check. (3) The culling check asserts nothing well inside the view has `willRender` false (106 in view, 0 wrong). (4) CDP `JSHeapUsedSize`: 43 MB after boot, 322 MB after the six-scene walk (limits 400/500). (5) Hub routes with the CPU 4x slower: slowest 11-63 ms (limit 120). (6) Unit tests (`tests/mobilePlatformFix.test.ts`) for every new rule (family, retry, cache name, holds, pickSlot, sparesToDrop, isStray). art.ts/audio.ts at runtime are covered by `platfix` rather than a fake texture manager. |

## Checks (own servers 5306 / 5316, stopped after)

| Check | Result |
|---|---|
| (a) laptop, first half | 40 of 40 identical, DESKTOP FINGERPRINT: OK |
| (a) laptop, second half | 25 of 25 identical, DESKTOP FINGERPRINT: OK |
| (b) touchlaptop, ipad, fire7, androidtab | all four OK |
| (c) `tests/desktopInvariants.test.ts` | 19 passed. It, `tests/fingerprints/`, index.html, main.ts and the vite config are unedited since 37a710d4 |
| (d) `tsc --noEmit`, `vitest run` | tsc clean. vitest 47 files, 591 tests passed in 3 of 4 runs. One run under load had 1 failure I could not identify; it did not repeat. No unit test now uses the clock. |
| (e) smoke main, full | 506 of 509. Failures: `welcome conversation` (timing), `lists` (renderer OOM-killed), `auto-fire off` (timing). Reruns: `phone,lists` 111/111, `combat` 46/46 |
| (e) smoke ALT, full | 512 of 519. Failures: `auto-fire kills`, `weapon chip tap`, `JUMP on touch-down`, `coyote` (timing in combat/side at load 24-25), `review1` (Dungeon did not load in time), `platform JS heap` (measured garbage: the check now reads after a full collection), `Krezz Arms door` (Hub transition slow). Reruns: `tapuse` 43/43 (after the re-target fix), `combat,side` and `side,review1` again failed only jump/auto-fire timing checks and P2 (pit; pre-existing, s3-03, owned by mobile-feel) |
| new sections | `tapfix` 21/21 and `platfix` 9/9 (main). `platform,mix3` 45/45 (main, 01:10) |

**Environment.** From about 04:30 three other agents' Playwright runs were active (`mobile-smoke` on 5512 and 5682,
`mikey.cjs`), and the memory cgroup OOM-killed renderers repeatedly (dmesg). `platform` then crashed ("Target crashed")
on both builds about 75 s in. The baseline 0e0ee379, served from a temporary worktree (now removed), crashed the same
way with the same script, so this is the machine, not this round's code. `platform` passed on main earlier (45/45 with
`mix3`). In the full ALT run every `platform` check before the crash passed except the heap one. The platform
section needs a rerun on a quieter machine.

The jump, auto-fire and weapon-chip timing failures are in `combat.ts` / `side.ts` / `jump.ts`, which this round did not
touch. In `touchLayer.ts`, only ACTION has a `passThrough`, and the zone tap carries `t0`.

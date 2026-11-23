# 05 · Final gate, round 1 (stage 1)

**Verdict: PASS.** Stage 1 is safe to publish. On a laptop the game is the same as before. A phone player can
get from boot into the game and around it by touch without a blocker.

- **Head:** `e8cf3f4f` on branch `mobile` (worktree `scratchpad/mobile-wt`), 8 commits on `dda0580c`.
- **Who ran it:** I ran every check myself on 2026-11-23. I trusted none of the earlier reports.
- **How:**
  - dev servers 5207 (normal) and 5217 (ALT);
  - a base-source server on 5227 (`git archive 9ccb2d13`), used only for the before/after comparisons;
  - production builds served from a temp folder on 5237.
- **State left behind:** all servers stopped. The builds and the base copy are deleted. The worktree is clean and nothing was pushed. The main checkout was not touched (clean, still on `d071280b`).

## Blockers

None.

## Check results

| # | Check | Result |
|---|---|---|
| 1a | `desktop-fingerprint --check --only shell,front,newgame,hub,meeting,dungeon` | **40 of 40 identical, DESKTOP FINGERPRINT: OK** (227 s) |
| 1b | `desktop-fingerprint --check --only boss,side,places,minigames,finale,alt` | **25 of 25 identical, DESKTOP FINGERPRINT: OK** (267 s) |
| 1c | `--profile` touchlaptop / ipad / fire7 (front, newgame) and androidtab (front, newgame, hub) | 16/16, 16/16, 16/16, 29/29: all **OK** |
| 1d | Sensitivity: is the check able to fail? (laptop run checked against the touchscreen-laptop baseline) | **DIFFERENT**, as it should be: 0 of 7 identical (listener counts differ). The check is not vacuous |
| 1e | `npx vitest run tests/desktopInvariants.test.ts` | 19 of 19. The file, `tests/fingerprints/desktop/` and `index.html` have no diff since `9ccb2d13` |
| 1f | `npx tsc --noEmit` | clean |
| 1g | `npx vitest run` | 395 tests, 39 files, all pass |
| 1h | Diff of every file outside `src/game/mobile/` since `9ccb2d13` | Game code: 4 files, every line a guarded hook or an import (see below). The rest is tooling: `scripts/`, `tests/`, the fingerprint baselines. `vite.config.ts`, `package.json` and `index.html`: no diff |
| 1i | Laptop played for 2 minutes, keyboard and mouse, real time, head vs base source (same script) | Everything worked; details below. No page errors |
| 1j | Laptop assertions (dev, after playing) | `isMobile()` false; `<html>` class empty; `body` class `fonts-loaded` (as in the baseline); no `.kt/.krot/.kres/.kah` element; no `window.__krelMobile`; localStorage = `krel_alive, krel_crumb, krelworld.meta, krelworld.save, krelworld.slots.v1` (the base's own keys); `UI.touch` null; only `flag.ts` and `boot.ts` fetched from `src/game/mobile/` |
| 2 | `npx vite build --outDir <tmp>` and `VITE_KREL_ALT=1 npx vite build --outDir <tmp>` | Both built: 16.5 s and 14.0 s. Main chunk 5,460.60 kB / 5,460.62 kB; phone chunk 84.77 kB (29.2 kB gzip). Output deleted |
| 2b | Production boot, laptop vs iPhone, both builds | **Laptop:** fetches only the main chunk, no phone chunk, no class, no layer, no global, no new storage key, no errors. **Phone:** fetches the phone chunk, gets `html.mobile` and the layer, no errors. ALT the same, with `alt:` keys |
| 3a | `scripts/mobile-smoke.cjs`, normal build (in two halves) | 139 + 36 = **175 of 175, MOBILE SMOKE: OK** |
| 3b | `scripts/mobile-smoke.cjs`, ALT build | 139 + 36 = **175 of 175, MOBILE SMOKE: OK** |
| 3c | My own touch play (real CDP touch), iPhone 14 landscape 844x390 | Every check ok over three runs: 26/26, 23/24 (the one miss was my script's bug), 15/15. Path below |
| 3d | Same, small Android 740x360 | 35/35, plus 25/25 for the fullscreen offer and quit / CONTINUE |
| 3e | Same, ALT build, iPhone | 27/27 |
| 3f | Same, Safari-with-bars 750x340 | 17 of 18: the one miss is my own over-strict centring check (gutters 72 / 73.6 px) |
| 3g | `?mobile=0` vs the game before phone work, as an iPhone and as a small Android | The fingerprint chains `front,newgame,hub,dungeon` (iPhone, 37 states) and `front,newgame,dungeon` (Android, 24 states) were played on the base source and on head with `?mobile=0`. Display lists, listeners, input, cameras, DOM, timing and saves are all identical. The **only** difference is the remembered opt-out key `krelworld.mobile = 0` (by design: `?mobile=0` is remembered) |
| 4 | Worktree clean; commit footers; model names | Clean (`git status` empty, no stash). 7 of 8 commits end with exactly the two required lines. `9ccb2d13` (the safety net) ends with the same two-line footer, but its Co-Authored-By line names the model this session used before the switch. That was the session's attribution when it was committed, and so it is accurate (see note N1). No commit body, file or baseline contains any other model name or any e-mail address |

## The game-code diff outside `src/game/mobile/` (all of it)

| File | Change | Guarded? |
|---|---|---|
| `src/main.ts` | `import { installMobile } from "./game/mobile/boot"` and `installMobile(game)` after `new Phaser.Game(...)` | Yes. `boot.ts` returns at once unless `isMobile()`. The phone chunk is a dynamic `import("./index")`, and production confirms a laptop never fetches it |
| `src/game/scenes/UIScene.ts` | import `isMobile`, and in `setupTouch()` `if (isMobile() && this.mode !== "dungeon") { destroy pad; return }` | Yes. Only reached on touch devices; on a laptop `isTouchDevice` returns first |
| `src/game/scenes/TitleScene.ts` | imports, and in `fullscreenButton()` `if (isMobile()) { ADD TO HOME SCREEN button; return; }` | Yes |
| `src/game/scenes/MenuScene.ts` | imports, and the FULLSCREEN row is wrapped in `isMobile() && homeScreenEntryWanted() ? [guide row] : [original row]` | Yes. The original row text and handler are unchanged |

On a laptop the only new code that runs is `isMobile()`, decided once. It reads touch points and screen size and stops
there: no storage read, no media query (the smoke test checks this with spies). Everything else is in the lazy
chunk.

## Laptop played for 2 minutes (keyboard and mouse)

Script: `work/gate1/laptop-play.cjs` (real time, 1280x720, pointer lock pinned as the fingerprint harness does). The
route:

1. Enter → title.
2. Mouse: NEW GAME → first face → NEXT: BANTER → LET'S KREZ.
3. Home: Space / E / Tab through the welcome.
4. D then W walks (420,500 → 616,500 → 616,455).
5. A to the telly, whose prompt says "E: Watch KrelTV". E opens the TV, Esc switches it off.
6. Esc → pause → RESUME.
7. Hub: D / S walks; Esc → pause → SETTINGS → back → resume.
8. Wildern room 1, through the fly-in, the conversation and the tutorial. W / A move. Mouse aim plus held fire, with
   D and a Space dodge: moved 600,630 → 1120,507.
9. Esc → pause → resume.
10. A further 60 s of fighting with WASD, mouse aim and fire, and dodges. The room was cleared (7 → 0 enemies, HP
    27/90).

119 s, no page errors. The same script on the base source behaves the same way (it went on into the next room's
conversation). The screenshots look the same: `lap-head-*` and `lap-base-*`.

## Phone played by touch (first five minutes)

Script: `work/gate1/phone-play.cjs`. Real CDP touch events only (taps, stick drags, the DOM buttons). The town
walking uses a route through the Hub's colliders, driven by the visible stick.

**iPhone 14 landscape**, as a new player:

1. Boot. Canvas 693x390, gutters 75 / 75.7.
2. TAP TO START. The Add to Home Screen guide shows itself (iPhone Safari variant); NOT NOW closes it.
3. NEW GAME → character → BANTER → LET'S KREZ, all by taps.
4. Home welcome. No controls over the conversation; 12 taps reach the end.
5. Walk mode. The idle stick shows MOVE and pause is up. A drag walks 226 px and letting go stops.
6. Walk to the telly. ACTION says WATCH and the bubble says "Tap: Watch KrelTV".
7. The welcome show: you must watch it to the end before going out (that is the game's own rule). 21 taps on the
   screen, 19 s.
8. Walk to the door: ACTION **GO**. The flyover takes 8 s.
9. Town, walk mode. The first toast speaks touch ("Drag on the left to walk. Tap to talk/interact... II for the
   menu"). No key words are left on screen in town.
10. Upright: the rotate screen is up and the loop sleeps. Sideways again: running, controls back, the stick walks.
11. Hidden in mid-walk: the stick lets go and the loop sleeps. Visible again: running, no ghost walking, the stick
    works.
12. Pause button → the pause menu (it has 📲 ADD TO HOME SCREEN) → RESUME by tap.
13. **Interior:** walk to the Krezz Arms (ACTION ENTER). Its card menu works by tap, and **Leave** brings you back to
    town in walk mode.
14. **Story path:** walk to the Town Hall (ACTION ENTER). The meeting, the cutscene, a second meeting, the reaction
    circles (tapped), the KrelTV broadcast and back. That is about 250 taps over 2.5 minutes, and you end in town
    with walk controls.
15. **Dungeon** (debug jump; the story path to Wildern is long):
    - tap through the conversation and the touch tutorial (NEXT ▶, LET'S GO);
    - the old pad runs the fight: the old stick moves the player 266 px, ATTACK held fires and letting go stops, II
      opens pause;
    - upright then sideways in mid-fight: the pause menu waits;
    - at the end: no stuck input (stick 0, attack false).

**Small Android 740x360** ran the same route and every check passed:

- **Boot:** the Android Chrome guide variant shows.
- **Fullscreen:** the Enter tap goes fullscreen. When the test left fullscreen to rotate, the layer's fullscreen offer
  appeared, and tapping it went back into fullscreen (`#game`).
- **Back to the title:** pause → QUIT TO TITLE shows CONTINUE and ADD TO HOME SCREEN, with no thumb controls over the
  title. CONTINUE by tap goes back to town in walk mode, and the stick walks.

**The ALT build** on iPhone: the same route, 27/27, identical behaviour.

**Safari with its bars (750x340)**: the same route through pause, all fine. Nothing touchable is in the bottom strip.

## Notes (not blockers; for the coordinator and later stages)

- **N1. The safety-net commit's footer.** `9ccb2d13` ends with Co-Authored-By naming the model that wrote it, before
  the user switched models. The other seven commits carry the exact required line. Rewording it would also change
  the SHA of every commit after it. Several files refer to `9ccb2d13` by SHA as the base the profile baselines were
  recorded from (`tests/fingerprints/README.md`, `04-fix-round1.md`). Since the footer is true attribution, I did
  not treat it as a blocker. Whether to reword it is the coordinator's call.
- **N2.** `?mobile=0` opened **on a laptop** writes `krelworld.mobile = "0"` to localStorage. `flag.ts`
  `resolveMobile` stores the opt-out whatever the device. A normal laptop visit writes nothing (fingerprint and smoke
  confirm), so this only happens with that address. If wanted: store the opt-out only when the device has touch
  points.
- **N3. Key wording still shown on phones** (stage 2 sweep, already listed in DEFERRED):
  - the meeting's reaction card "REACT (1-5 or click)";
  - the TV buttons' captions "Space / click", "Tab", "Esc";
  - the dialogue footer.

  The meeting's reaction circles are 46 CSS px, so they are fine to tap.
- **N4. No skip in conversations yet.** The welcome is 12 taps and the first Town Hall visit about 250 taps (stage 2
  SKIP). It is not a blocker, but it is the biggest "slog" in the first five minutes.
- **N5. The stick covers the player at the left edge.** At 750x340 the idle stick ring sits over the player when they
  stand at the telly (Home's far left). Buttons go see-through in that case; the stick does not. This is minor and
  belongs to the stage 2 HUD work.
- **N6. Fights are still on the old twelve-button pad** (stage 2). In a dungeon, the Android fullscreen offer is not
  shown after leaving fullscreen: the layer is in legacy mode there. You can go back to fullscreen from town.
- **N7. The DEBUG button.** The title's "🛠 DEBUG" button shows on phones and laptops alike. It was there before the
  phone work.
- **N8. Off-centre at 750x340.** At that size the canvas sits 1.6 px off centre (gutters 72 / 73.6). You cannot see it.

## Files

- Logs and scripts: `scratchpad/mobile/work/gate1/`.
  - fingerprint logs: `fp-half1.log`, `fp-half2.log`, `fp-<profile>.log`, `fp-sensitivity.log`,
    `fp-iphone-head-optout.log`, `fp-android-head-optout.log`;
  - smoke logs: `smoke-{main,alt}-{a,b}.log`;
  - build logs: `build-{main,alt}.log`;
  - scripts: `laptop-play.cjs`, `phone-play.cjs`, `prod-check.cjs`, `fp-phone.cjs` (runs the fingerprint chains as a
    phone).
- Screenshots (27, 1x CSS): `scratchpad/mobile/shots/gate1/`.
  - Laptop: `lap-head-*` and `lap-base-*`.
  - Phone, and the per-run logs `*-play-log.txt`:
    - `iphone-*`: the main and ALT runs, which behave the same;
    - `android-*`;
    - `safari-*`.

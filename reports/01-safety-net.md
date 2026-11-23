# 01 · Laptop safety net (stage 1, first commit)

**Commit:** `9ccb2d13` on branch `mobile` (worktree `scratchpad/mobile-wt`), first commit on top of `dda0580c`.
**Game code changed:** none. Only test tooling and recorded baselines were added.
**Determinism:** proven. The full set was recorded on the untouched base, then re-run with `--check` twice:
65 of 65 states byte-identical each time (three identical runs for most states, four for the minigames chain).
`npx tsc --noEmit` passes; `npx vitest run` passes (241 tests: the 222 there were, plus 19 new).

## What was added

| File | What it is |
|---|---|
| `scripts/desktop-fingerprint.cjs` | The command: runs the chains, records or checks, prints a per-state diff, total time. |
| `scripts/fingerprint/core.cjs` | The browser session: laptop profile, fake clock, seed, loading waits, sound stand-ins, input helpers. |
| `scripts/fingerprint/dump.cjs` | What is read out of the page for a state, and the file format. |
| `scripts/fingerprint/states.cjs` | The 12 chains and 65 states, and how each is reached. |
| `tests/fingerprints/desktop/*.json` | The baseline: 65 states + `_env.json` (1.4 MB). |
| `tests/fingerprints/README.md` | How to run, what a fingerprint holds, what is not covered, the rule. |
| `tests/desktopInvariants.test.ts` | 19 vitest snapshot tests of the pure tables (runs in node with the normal suite). |

## How to run it

Port convention: normal build on 52x1, ALT build ten higher. Mine were 5201 / 5211. Always `localhost`.

```sh
cd <the checkout under test>
npx vite --port 5201 --strictPort &
VITE_KREL_ALT=1 npx vite --port 5211 --strictPort &

# CHECK (writes nothing; exit 0 = identical, 1 = something differs, 2 = bad arguments / crash)
node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --alt-url http://localhost:5211/ --check

# the same in two halves (each under 6 minutes; use this if the shell has a 10 minute limit)
A="--url http://localhost:5201/ --alt-url http://localhost:5211/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt

# one state or one chain (20 to 65 s)
node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --no-alt --check --only title
node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --no-alt --check --only hub

# RECORD (overwrites tests/fingerprints/desktop: only for a deliberate new baseline)
node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --alt-url http://localhost:5211/

pkill -f "vite --port 5201"; pkill -f "vite --port 5211"
```

Useful extras: `--out <dir>` (check: save the new version of what differed), `--shots <dir>` (a 1x screenshot of
every state, and of where a chain got stuck), `--baseline <dir>` (record to / check against another folder),
`--list`, and `FP_DEBUG=1` in the environment (print the stack when a chain fails).

Unit part: `npx vitest run tests/desktopInvariants.test.ts` (under 5 s).

## The rule for every later phone commit

1. `--check` ends with `DESKTOP FINGERPRINT: OK`.
2. `tests/desktopInvariants.test.ts` passes **unedited**.

If either fails, the commit changed the laptop game: put the change behind `isMobile()`. Do not re-record.

## Timings (this machine, software WebGL)

- A page load to the Enter gate: 10 to 12 s (14 s when another browser is busy).
- A frame, stepped: about 27 ms at home, 45 ms on the title, 60 to 70 ms in a dungeon, 73 ms in town, 82 ms in Kreddle.
- Per chain: shell 20 s · front 30 s · newgame 52 s · hub 60 s · meeting 28 s · dungeon 54 s · boss 63 s · side 45 s ·
  places 52 s · minigames 50 s · finale 38 s · alt 42 s.
- Everything: 8.5 to 10.5 minutes (about 9,500 stepped frames, 12 page loads).
- The unit tests: under 5 s.

## States covered (65)

| Chain | States |
|---|---|
| `shell` | `shell_windows` (canvas box and margins at 1280x720, 1440x900, 1024x768, 1720x720, and back) |
| `front` | `enter`, `title`, `title_password` (the Chapter Select password box, with its DOM input), `settings_sound`, `settings_play`, `tv_from_title`, `tv_guide` |
| `newgame` | `charselect`, `difficulty`, `banter`, `home_welcome` (dialogue box open), `home`, `probe_home_move`, `probe_home_interact`, `tv_episode`, `pause_home` |
| `hub` | `hub` (at the front door), `probe_hub_move`, `probe_hub_pause`, `pause`, `pause_quests`, `pause_log`, `pause_controls`, `pause_settings`, `pause_difficulty`, `pause_banter`, `slots_save`, `title_with_save`, `slots_load` |
| `meeting` | `meeting`, `meeting_later` |
| `dungeon` | `dungeon_dialogue` (the Dialogue overlay scene), `dungeon_tutorial`, `dungeon_fight` (Wildern room 1, first wave in), `probe_dungeon_move`, `probe_dungeon_dodge`, `probe_dungeon_fire`, `pause_dungeon`, `wonk_gauge` |
| `boss` | `chapter_select`, `chapter_select_bosses`, `boss_vs`, `boss_room` (Chapter 2's boss, with six guns), `probe_boss_fire` (ammo 14 to 13), `probe_boss_swap`, `weapon_picker` |
| `side` | `side_room` (Crobley factory floor), `probe_side_run`, `probe_side_jump` (y for 70 frames: up, over, back down) |
| `places` | `pub`, `club`, `kreddle`, `exchange`, `pit_board` |
| `minigames` | `crocodile`, `beepbeep` |
| `finale` | `ssj_brawl` |
| `alt` (ALT build) | `alt_enter`, `alt_title`, `alt_charselect`, `alt_home_welcome`, `alt_home`, `alt_hub`, `alt_pause` |

Every item on the brief's list is in. Extras beyond it: the Chapter Select list and its boss list, the VS card,
the weapon picker, the dungeon tutorial, pause at home and in a dungeon, the title once a save exists, a dodge
probe and a gun-swap probe.

Each state file holds: every running scene's visible objects (type, position, size, origin, scale, depth, alpha,
scroll factor, tint, texture and frame, text and font, hit area), hidden-object counts, cameras, scene list and
order, game config, scale manager, canvas box and style, `<html>` / `<body>` classes and attributes, children of
`<body>` and `<head>`, computed shell CSS, globals added to `window`, every add/removeEventListener call by target
and type, localStorage keys written and their contents, the music track and `<audio>` elements, media queries, the
save's headline numbers, the fake clock, and page errors (none in the baseline).

## What the unit test pins (tests/desktopInvariants.test.ts)

`difficultyDef()` for all five levels, the level limits and labels, `defaultSettings()`, `newMeta()`, every field of
`newGameState("FLENKY")`, each playable lad's starting numbers and base stats, the guns table, every rebindable
action with its default keys, default gamepad buttons, banter levels, the save keys and slot keys, which game files
touch localStorage (outside `src/game/mobile`), a hash of `index.html`, the Phaser config and scene list in
`main.ts`, the order of main.ts's `install*()` calls, and "any `isMobile()` exported under `src/game/mobile` returns
false in node".

## Excluded, and why (the stable subset)

| Excluded | Why | What stands in |
|---|---|---|
| All sound playback: voices, effects from files, real music, voice-timed line advance | Real audio runs on real time, not the fake clock; fetching and decoding 206 effect files per page is slow and its timing leaks into the seeded random stream | `public/audio/**` answers 404; `<audio>` and the Web Audio clock run on the fake clock; text-to-speech removed. The music track asked for and each `<audio>` element's source / volume / loop are still recorded |
| Rendered pixels | Display-list comparison only | `--shots` for eyes |
| Real pointer lock | Headless Chromium's answer varies | A request locks at once, so the game's mouse-lock path still runs (first click is swallowed, virtual cursor, drawn cursor div) |
| Texture list order | It is the order the art arrived in; Beep Beep picks pedestrians from it. This was the one real flicker found (2nd run: different pedestrian sprites, same positions) | Sorted by name after loading |
| The loading phase itself | Takes a different number of frames each run | The clock jumps to a fixed tick and date afterwards and the Enter gate is restarted |
| Frame rate, per-frame cost, memory | Not measurable on a stepped fake clock | Extra listeners / timers / tweens / game-event hooks do show as counts |
| Gamepad input, touch-screen laptops | Not driven | Pad defaults are in the unit test |
| Scenes not listed | Time | See the README's list (Archive, Venue, Drive, Lair, Roof, Polson's home, Exile, Whack, Kreddle machines, raid / rout, most minigames and vignettes, death menu, Kreltality prompt, 3D ending, flyover). A phone change touching one of these needs its own before/after check, or a new state recorded first |
| System-font text widths on another machine | A few texts fall back to system fonts | `_env.json` records the browser and font metrics; `--check` warns when they differ; `--baseline` lets you compare against a base recording made on your machine |

Nothing was dropped silently: every state that was attempted is in.

## Things later stages should know

- **What trips the check on a laptop:** a class or attribute on `<html>` / `<body>`, any new element in `<body>` or
  `<head>` (a `<style>` too: an imported `.css` file adds one in dev, so inject phone CSS at runtime on phones
  only), any `addEventListener` call (a touch listener registered "just in case"), a new global on `window`, a new
  listener on `game.events` / the scale manager, a new localStorage key written, an extra pointer
  (`input.addPointer`), an extra timer or tween in a scene, any object added to a scene (visible or not), any moved
  or resized object, any changed text. Importing a phone module from an existing file is fine as long as the import
  has no side effects on a laptop.
- **Laptop behaviours now on record (do not "fix" them for laptops without the user's say-so):**
  the canvas is off-centre in windows that are not 16:9 (1440x900: 67.5 px above, 22.5 below; 1720x720: 330 px left,
  110 right), exactly as the audit said; the first click on the canvas grabs the mouse and is swallowed (so a click
  on the Enter gate does nothing the first time, a key does); `body` gets the class `fonts-loaded`.
- **Text that mentions keys, seen on the way** (wording is for the stage 2 sweep; the first two are narrator /
  tutorial lines, check whether they count as dialogue before touching them): the welcome at home ("TIP: WASD /
  arrows (or the stick) to walk. E to use things..."), Wildern's arrival line ("CONTROLS: WASD move · Mouse aim ·
  Left click attack..."), the town HUD tip ("WASD to walk. E to talk/interact. Follow the yellow arrow. Esc for
  menu"), the dialogue footer ("▼ E / Space · Tab skip"), the title's bottom line, the weapon picker's hint, the
  SSJ banner ("HOLD R TO BLAST KI"), Beep Beep ("SHIFT BOOST · E HORN"), crocodile's key legend, the TV buttons'
  captions.
- **The harness is reusable for phone tests.** `scripts/fingerprint/core.cjs` exports `Session` (boot to a fixed
  moment, `frames()`, `until()`, `click()`, `clickText()`, `key()`, `clear()`, `sample()`); a phone profile would
  need its own context options and touch helpers, but the clock / seed / loading-wait machinery carries over.

## Pitfalls I hit

1. `page.route(/\/audio\//)` also matched the game's own `src/game/audio/*.ts` modules, so `main.ts` never ran
   and nothing reported an error. The route is anchored to the site root now.
2. Playwright's `clock.pauseAt()` leaves the wall clock a fraction of a millisecond off (a different fraction each
   run), and the tick counter after loading differs by a few ticks per run. First symptom: `savedAt` in the save
   one millisecond apart between runs; second: the crash guard's breadcrumb timestamp. Fix: after loading,
   `fastForward` to one fixed tick (a multiple of 16) and `setSystemTime` to the fixed date, before and after.
3. The texture list order (see above): only showed on the second full run. Run things more than once.
4. Between a room's title card closing and its conversation opening there are a few frames with only `Dungeon` and
   `UI` running: "no overlay scene left" is not "ready". The skip helper also waits for `Dungeon.busy` to clear.
5. Chapter Select boss rooms open with a fly-in shot, a title card, a conversation (sometimes two) and a VS card.
6. `tsc` type-checks `tests/` and there are no node typings in the repo: tests must read files with `?raw` imports
   and `import.meta.glob`, as the existing tests do, not with `node:fs`.
7. A full run is just under the shell's 10 minute limit when the machine is quiet and over it when it is not: run
   it in the two halves above.
8. Do not `pkill` browsers by name: another agent's browser may be running. Close your own with `browser.close()`
   (the script does) and only `pkill -f "vite --port <your port>"`.
9. Every state after an early one in a chain inherits its changes: read the first diff of a chain first.

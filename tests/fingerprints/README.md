# Desktop fingerprints: the laptop safety net

The phone version is built on top of the laptop game, and the rule is that **the laptop game does not change**:
not how it looks, not how it plays, not what it saves. This folder is how that gets proven rather than promised.

Before any phone code existed, the laptop game was written down in two ways:

1. **`tests/fingerprints/desktop/*.json`**: 65 game states recorded in a real browser by
   `scripts/desktop-fingerprint.cjs` (Playwright, laptop profile). One file per state.
2. **`tests/desktopInvariants.test.ts`**: the pure numbers and tables (difficulty, default settings, a new save,
   key and pad bindings, storage keys, the page shell, the Phaser config), as vitest snapshots. Runs with the
   normal `npx vitest run`.

## The rule

Every later commit (every phone commit above all) must keep both of these true:

- `node scripts/desktop-fingerprint.cjs ... --check` ends with `DESKTOP FINGERPRINT: OK` (exit code 0);
- `tests/desktopInvariants.test.ts` passes **without being edited**.

If either fails, the commit changed the laptop game. Fix the commit (put the change behind `isMobile()`), not the
baseline. The baseline is only re-recorded when the laptop game is changed on purpose, by someone who says so in
the commit message, from a commit that has no phone changes in it.

## How to run it

It needs two dev servers from the checkout you are testing (the normal build and the ALT build), and Playwright
with Chromium (already installed on the build machine; nothing to `npm install`).

```sh
# in the checkout under test
npx vite --port 5201 --strictPort &                    # normal build
VITE_KREL_ALT=1 npx vite --port 5211 --strictPort &    # ALT build

# compare with the committed baseline (writes nothing)
node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --alt-url http://localhost:5211/ --check

# stop the servers when done
pkill -f "vite --port 5201"; pkill -f "vite --port 5211"
```

Port convention: the normal build on 52x1, the ALT build ten higher (5201 / 5211). Use your own pair if those are
taken. Always use `localhost` in the URL (the title screen shows its debug button on `localhost` only, and the
baseline has it).

Other ways to call it:

| Command | What it does |
|---|---|
| `... --check` | Re-runs everything, prints a diff per state that differs, exits 1 if anything does. Writes nothing. |
| `... --check --only hub,pause` | Only those states. `--only` takes state names or whole chain names; a state's chain is played up to it. |
| `... --check --no-alt` | Leaves the ALT states out (then `--alt-url` is not needed). Not a full check. |
| `... --check --out /some/dir` | Also saves the new version of each state that differed, to look at. |
| `... --shots /some/dir` | Also saves a 1x screenshot of every state (for people; never compared). |
| `... --list` | Prints the chains and their states. |
| (no `--check`) | **Records**: overwrites `tests/fingerprints/desktop`. Only for a deliberate new baseline. |
| `... --baseline /some/dir` | Record to, or check against, another folder (e.g. a baseline of the base commit made on your machine). |

**How long:** about 9 minutes for everything (12 pages, about 10 s each to load, then about 9,500 frames stepped
one at a time). A single chain is 20 to 65 s. If your shell has a 10 minute limit, run it in two halves:

```sh
A="--url http://localhost:5201/ --alt-url http://localhost:5211/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt
```

One browser at a time: do not run two of these (or this and another browser test) at once on the build machine.

## What a fingerprint holds

Each state is reached the way a laptop player would reach it where that is practical (real key presses and mouse
clicks, the game stepped one 16 ms frame at a time), in a laptop browser: 1280x720 window at 1x, no touch, a fine
pointer that can hover, a desktop Chrome user agent, empty storage.

For that state the file records:

- **`display`**: every running scene, and for every *visible* game object in it (containers are walked): type,
  x, y, display width and height, origin, scale, rotation, depth, alpha, scroll factor, tint, flip, texture key and
  frame, and its interactive hit area. Texts also have their words, font, size, style, colour, wrap and the size
  the scene asked for before the pixel-font patch. Graphics have a hash of their drawing commands, shapes their
  fill and stroke, physics bodies their size. Hidden objects are counted (`count`), so an object added to the
  laptop's display list shows up even if it is invisible. Per scene: the main camera (scroll, zoom, bounds, follow,
  effects), input and keyboard listeners, registered keys, timers, tweens, the physics world.
- **`scenes`**: which scenes are running, paused or asleep, and the draw order of all of them.
- **`game`**: the config that matters (size, scale mode, centring, parent, renderer, fps, input and physics
  settings), the scale manager, the number of pointers, and how many listeners hang off the game, the scale manager
  and the input manager.
- **`dom`**: the canvas's box and style, the classes and attributes of `<html>` and `<body>`, every child of
  `<body>` and of `<head>`, the viewport meta tag, computed shell CSS (touch-action, user-select, overflow,
  cursor...), what has focus, pointer lock, and any global the page added to `window`.
- **`listeners`**: every `addEventListener` / `removeEventListener` call since the page loaded, counted by target
  and event type (with capture / passive / once).
- **`storage`**: the localStorage keys written and removed, and what is in each now.
- **`audio`**: the music track, and each `<audio>` element made (source, playing, loop, volume, rate).
- **`media`**: what the browser says it is (pointer, hover, touch points, orientation).
- **`run`**: the save's headline numbers (player, chapter, hp, coins, gun...).
- **`clock`**: the fake clock when it was taken. It moves 16 ms per frame, so a change here means the state was
  reached in a different number of frames.
- **`how`**: what had to be skipped to get there (a fly-in shot, a conversation, tutorial pages).
- **`errors`**: page errors and console errors (none, in the baseline).

To keep the files small, a game object's line leaves out whatever is at its default: `o` (origin) 0.5,0.5 · `s`
(scale) 1,1 · `rot` 0 · `d` (depth) 0 · `a` (alpha) 1 · `sf` (scroll factor) 1,1 · no tint · no flip. `font` is
`family size style`; the game's two pixel-font stacks are written by their first name (`Krel Regular`, `Krel
Bold`, each followed in the game by `"Trebuchet MS", sans-serif`).

The `probe_*` states are **input probes**: what an input did, frame by frame.

| Probe | Input | Recorded |
|---|---|---|
| `shell_windows` | the window at 1280x720, 1440x900, 1024x768, 1720x720 | where the canvas sits (box, margins, gutters), the scale manager |
| `probe_home_move` | hold D for 60 frames at home | the player's position every frame |
| `probe_home_interact` | walk to the telly, press E | frames walked, the prompt, the scenes before and after, the episode that starts |
| `probe_hub_move` | hold D, then S, in town | player and camera position every frame |
| `probe_hub_pause` | Escape in town | the scenes before and after |
| `probe_dungeon_move` | hold W, then A, mid-fight | position every frame |
| `probe_dungeon_dodge` | Space while walking right | position every frame |
| `probe_dungeon_fire` | hold the left mouse button for 40 frames (Fart Blaster) | shots spawned and alive per frame, state before and after |
| `probe_boss_fire` | the same with a gun that uses ammo | shots per frame, ammo before and after |
| `probe_boss_swap` | tap X twice | the gun in hand after each |
| `probe_side_run` | hold D in a side-scrolling room | position every frame |
| `probe_side_jump` | press W (jump) for 4 frames | the player's y for 70 frames (the whole arc) |

## The states

`node scripts/desktop-fingerprint.cjs --list` prints them. In short:

| Chain | States |
|---|---|
| `shell` | `shell_windows` |
| `front` | `enter`, `title`, `title_password`, `settings_sound`, `settings_play`, `tv_from_title`, `tv_guide` |
| `newgame` | `charselect`, `difficulty`, `banter`, `home_welcome` (a dialogue box open), `home`, `probe_home_move`, `probe_home_interact`, `tv_episode`, `pause_home` |
| `hub` | `hub`, `probe_hub_move`, `probe_hub_pause`, `pause`, `pause_quests`, `pause_log`, `pause_controls`, `pause_settings`, `pause_difficulty`, `pause_banter`, `slots_save`, `title_with_save`, `slots_load` |
| `meeting` | `meeting`, `meeting_later` |
| `dungeon` | `dungeon_dialogue`, `dungeon_tutorial`, `dungeon_fight`, `probe_dungeon_move`, `probe_dungeon_dodge`, `probe_dungeon_fire`, `pause_dungeon`, `wonk_gauge` |
| `boss` | `chapter_select`, `chapter_select_bosses`, `boss_vs`, `boss_room`, `probe_boss_fire`, `probe_boss_swap`, `weapon_picker` |
| `side` | `side_room`, `probe_side_run`, `probe_side_jump` |
| `places` | `pub`, `club`, `kreddle`, `exchange`, `pit_board` |
| `minigames` | `crocodile`, `beepbeep` |
| `finale` | `ssj_brawl` |
| `alt` (ALT build) | `alt_enter`, `alt_title`, `alt_charselect`, `alt_home_welcome`, `alt_home`, `alt_hub`, `alt_pause` |

A chain is one fresh page played through in a fixed order. A change early in a chain can therefore show up in the
states after it too: read the first diff of a chain first.

Adding a state: add it to a chain in `scripts/fingerprint/states.cjs` (or add a chain), record it with
`--only <state>` on a commit with no phone changes, check it twice, commit the new file. Never re-record the
existing ones along the way.

## Why two runs give the same bytes

Nothing in the game was changed for this. The harness pins everything down from outside, in an init script that
exists only in the harness (`scripts/fingerprint/core.cjs`):

- **Time** is Playwright's fake clock, paused. The game moves only when the harness steps a 16 ms frame. After the
  page has loaded (which takes a different time every run), the clock is jumped to one fixed tick and one fixed
  date, and the Enter gate is started afresh, so nothing from loading leaks into a state.
- **`Math.random`** is a seeded generator, re-seeded at that same moment.
- **Storage** starts empty (a new browser context per chain).
- **Loading**: after every frame the harness waits until no request, image, font or fetch is still in flight.
- **Sound** is taken out (see below).

Determinism was proven on the untouched base commit: the whole set recorded, then re-run with `--check`, with
byte-identical output.

## What is NOT covered (read this before trusting a green check)

- **Sound.** No audio file is fetched or played in the harness: `public/audio/**` answers 404, `<audio>` elements
  are stand-ins that run on the fake clock, the Web Audio clock is the fake clock, and text-to-speech is removed.
  So recorded voices, their timing (a line waiting for its voice to finish), sound effects from files and real
  music playback are not fingerprinted. What *is* recorded: which music track is asked for and each `<audio>`
  element's source, volume and loop flag. Phone audio work must be checked on the laptop by ear as well.
- **Pixels.** This compares the display list, not the rendered picture. A shader, a post-effect, a texture's
  contents or draw-order ties inside one depth could change without a diff. Use `--shots` and your eyes for that.
- **Pointer lock** is simulated: a request locks at once (headless Chromium's own answer varies), so the game's
  laptop mouse-lock path runs, but not the browser's real lock.
- **The order art finishes loading in** is put in name order after loading (Phaser's texture list is in arrival
  order otherwise, and Beep Beep picks its pedestrians from that list).
- **Real time.** Frame rate, performance and per-frame cost are not measured. A hook that does work every frame on
  the laptop without changing the display list would only show as an extra listener, timer or tween count.
- **Gamepads** and real touch-screen laptops are not driven. (A gamepad's default buttons are in the unit test.)
- **Scenes not in the list**: the Archive, Venue, Drive, Lair, Roof cutscene, Polson's home, Exile, the Krazy Fact
  screen, Whack-a-Drongus, the Kreddle machines, raid and rout, most minigames (only crocodile and Beep Beep are
  in), most vignettes and cutscenes, the death menu, the Kreltality prompt, the 3D ending and the flyover. A phone
  change that touches one of those needs its own before/after check.
- **Text sizes in system fonts.** Almost all text is in the game's own pixel fonts, which ship with it. The few
  texts in system fonts (Courier, Georgia, Impact fall-backs, emoji) measure differently on another machine.
  `_env.json` records the browser and font metrics the baseline was made with; `--check` warns if yours differ.
  On a different machine, record a baseline of the base commit there (`--baseline`) and compare against that.

## Files

- `scripts/desktop-fingerprint.cjs`: the command (arguments, running the chains, the diff).
- `scripts/fingerprint/core.cjs`: the browser session: fake clock, seed, loading waits, sound stand-ins, input helpers.
- `scripts/fingerprint/dump.cjs`: what is read out of the page for a state, and the file format.
- `scripts/fingerprint/states.cjs`: the chains and states.
- `tests/fingerprints/desktop/`: the baseline. `_env.json` is the machine it was recorded on.
- `tests/desktopInvariants.test.ts`: the unit snapshots.

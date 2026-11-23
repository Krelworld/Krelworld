# Phone mode (`src/game/mobile/`)

KRELWORLD on a phone held sideways. Everything phone-only lives in this folder. On a laptop (touchscreen or not), a
tablet, or in node, none of it runs: `installMobile()` returns at once, so the laptop game is byte-for-byte what it was
(proved by `scripts/desktop-fingerprint.cjs --check` and `tests/desktopInvariants.test.ts`).

## How it fits together

```
main.ts ── installMobile(game) ──► isMobile()? no → return (nothing at all happens)
                                   yes ↓
            phone settings         its own storage key (settings.ts), loaded before anything lays itself out
            install prompt         beforeinstallprompt kept for the guide's INSTALL button (Android)
            TOUCH.enabled = true   (the game's own touch paths: wording, auto-aim, the raid's FIRE button)
            Shell  (shell.ts)      html.mobile + CSS, single centring, rotate screen, sleep/wake, fullscreen, back guard
            TouchLayer (touchLayer.ts)  HTML controls inside #game, above the canvas
            HomeScreenGuide        the Add to Home Screen guide (homeScreen.ts) + the rotate screen's button
            Readability            font floor + 44 px taps (readability.ts), OFF unless the setting / ?mobileread=1
            PromptWording          touch wording on the walking scenes' prompts (wording.ts)
            DiagOverlay            only with ?mobilediag (diag.ts)
            game POST_STEP ──► shell.frame(); wording.frame(); layer.frame(); readability.frame(); first-run guide
                                   layer.frame():  readView(game)  ──►  resolveMode(view)  ──►  layer.apply(decision)
                                                   (observe.ts)         (modes.ts, pure)
```

| File | What it does |
|---|---|
| `flag.ts` | `isMobile()`, decided once at load. Pure `detectPhone()` / `resolveMobile()` for tests. `setMobileForTests()` |
| `platform.ts` | iPhone / Android / home-screen app / in-app browser (pure `platformFrom()`) |
| `settings.ts` | The phone's own settings: one typed object, defaults, its own storage key, change listeners, and `phoneSettingsList()` (the typed list a settings screen renders) |
| `readable.ts` / `readability.ts` | Readability: the phone-only font floor (no text under 10 CSS px) and 44 CSS px tap areas. OFF until stage 2 turns it on |
| `wording.ts` | Touch wording: `hint()` and the `TOUCH_WORDING` table ("E: Talk" → "Tap: Talk"); applied to the walking scenes' prompts |
| `homeScreen.ts` | The Add to Home Screen guide (per browser, drawn buttons, install prompt, saves warning), its title / pause / rotate entries |
| `diag.ts` | `?mobilediag`: a small read-out for checking a real phone (fps, texture and sound memory, sizes, insets, mode, why, last error) |
| `haptics.ts` | A short buzz on presses where the phone can (Android), behind the Vibration setting |
| `battery.ts` | Battery saver: the loop capped at 30 frames a second, live |
| `layout.ts` | Pure layout maths: slots, scale, safe area, Dynamic Island band, hit areas, stick zone and stick maths |
| `modes.ts` | Pure: `LayerMode`, `GameView`, `ModeDecision`, the scene table `SCENE_RULES`, `resolveMode()`, `verbFromPrompt()` |
| `observe.ts` | Reads the live game (per-scene adapters: busy, prompt, side, raid/rout) and acts on it (interact, pause, SanMik) |
| `touchLayer.ts` | The DOM layer: floating stick, ACTION, prompt-bubble tap, pause, SANMIK, fullscreen offer, tap hand-over, `registerModeController()` |
| `shell.ts` | Page shell, rotate screen, lifecycle (hidden / pagehide / portrait), Android fullscreen + landscape lock, back-to-pause |
| `rotate.ts` | The "turn your phone sideways" screen (DOM, so it also covers the first load), with an empty `extra` slot |
| `css.ts` | All phone CSS, injected at runtime (index.html is never edited) |
| `index.ts` | `installMobile()`, `mobileLayer()`, `mobileShell()` and re-exports |

## Deciding phone mode

Phone = `(pointer: coarse)` AND `(hover: none)` AND `navigator.maxTouchPoints > 0` AND the short side of `screen` is
600 CSS px or less. `?mobile=1` forces it on (laptop + devtools device emulation), `?mobile=0` forces it off on a phone,
`?mobile=auto` forgets. The choice is remembered under `storageKey("krelworld.mobile")` (so the ALT build keeps its
own), and only ever written when the address asks: a normal laptop visit writes nothing.

`?mobile=0` on a phone is today's game exactly (the old canvas pad everywhere).

## Rules for hooks outside this folder

1. Only `if (isMobile()) …` / `isMobile() ? a : b` guards, and imports with no side effects.
2. Prefer observing from here (add an adapter in `observe.ts` and a row in `SCENE_RULES`) over editing a scene.
3. Never touch `index.html`, the scene list or the Phaser config in `main.ts`.
4. No dialogue or story text changes. UI wording for touch goes through a helper (stage 2), phones only.
5. Use `storageKey()` for any storage key. No listener, global, element, style or storage write on a laptop.

Hooks that exist now (stage 1):

| Where | What | Why |
|---|---|---|
| `src/game/scenes/TitleScene.ts` `fullscreenButton()` | `if (isMobile()) { if (homeScreenEntryWanted()) button(... "📲 ADD TO HOME SCREEN" ... openHomeScreenGuide("title")); return; }` | The title's corner opens the Add to Home Screen guide on a phone, replacing FULLSCREEN and the one-line iPhone hint (so it never shows twice). Laptops: unchanged |
| `src/game/scenes/MenuScene.ts` pause rows | `isMobile() && homeScreenEntryWanted() ? ["📲 ADD TO HOME SCREEN", () => openHomeScreenGuide("pause")] : [the FULLSCREEN row as it was]` | The guide from the pause menu, same row count (no layout change). Laptops: unchanged |
| `src/main.ts` | `import { installMobile }` and `installMobile(game)` right after the game is created | The one entry point (as early as possible so the rotate screen covers the first load). The invariants test ignores install calls named *mobile* |
| `src/game/scenes/UIScene.ts` `setupTouch()` | `if (isMobile() && this.mode !== "dungeon") { destroy the old pad; return; }` | On phones the town / interior controls are this layer, drawn above every scene (blocker B1: the old pad was drawn under Home, the Club, Kreddle and the Venue). The old pad still runs combat until stage 2 |

## Modes

`none · walk · combat · side · brawl · tap` (see `modes.ts`). The mode is worked out **every frame** from what is on
screen, never switched by a scene, so it cannot get stuck (research M11). The table (`SCENE_RULES`, first match wins,
topmost running scene per rule):

| Running scene | Mode | Pause |
|---|---|---|
| Boot, Enter, Title, CharSelect, Difficulty, Banter, ChapterSelect, DebugSkip, Menu, Slots, WeaponPick, Dialogue, Meeting, Cutscene, Vignette, TV, Archive, KrazyFact, Exile, Ending, Tutorial, Lair, RoofCutscene, KrelCue, `__p3d*` | none | – |
| Minigame, Whack, Drive, BeepBeep | tap | – (stage 3) |
| Pub, Pit, PitLoan, PolsonHome | none | – |
| Finale | brawl (legacy pad) | – |
| Dungeon | combat / side (legacy pad) | the canvas pad's II; the back gesture uses the Esc path |
| Home, Hub | walk (none while busy) | `edge`: the scene's own Esc path |
| Club, Kreddle, Venue | walk (none while busy or a machine is open) | `menu`: the pause menu over the scene (on a laptop Esc walks you out; each has an exit to walk to) |
| Kreddle with the raid / rout running | walk | `edge` (their own Esc → pause menu) |
| anything else | none | – |

`ModeDecision` = `{ mode, scene, pause, pauseButton, action, sanmik, legacyPad }`. `legacyPad: true` means the canvas
pad in the UI scene does this mode and the layer must not take a single touch (all its elements are
`pointer-events:none`, verified in combat).

### Adding a mode or controls (stage 2 and later)

```ts
import { addSceneRule, registerModeController, mobileLayer } from "../mobile";

// 1. decide it: a row in front of the stage 1 rows
addSceneRule({ name: "dungeon v2", match: (k) => k === "Dungeon",
  decide: (s) => (s.busy ? { mode: "none" } : { mode: s.side ? "side" : "combat", legacyPad: false, pause: "edge", pauseButton: true }) });

// 2. draw and drive it: enter / frame / release / leave
registerModeController({ id: "combat",
  enter: ({ layer }) => { /* add elements under layer.root, positioned from layer.slots (prime, upLeft, up, ...) */ },
  frame: ({ layer, game, decision }) => { /* per frame: transforms only */ },
  release: () => { /* zero every held input: page hidden, rotated, blur */ },
  leave: () => { /* hide / remove */ } });
```

and turn the old pad off for that mode with the same guarded line in `UIScene.setupTouch` (drop the
`this.mode !== "dungeon"` condition). Feed the game through `TOUCH` (`mx/my`, `attack`, `edges`, `held`) as the old pad
did. Note: `Controls.aim()`, `aimPoint()` and `attackHeld()` test `activePointer.wasTouch`, which a DOM control does not
set: combat needs a guarded hook there (audit section 3).

To read more of a scene, add an adapter to `ADAPTERS` in `observe.ts` (`busy`, where its `prompt` Text lives, `side`,
`sub`). To act on the game use `pressInteract()`, `pressPause()`, `pressSanmik()` (the same `TOUCH.edges` the canvas pad
sends), or `layer.injectTap(clientX, clientY)` to hand the game a real tap.

## Input rules the layer keeps

- Real CSS px, anchored to the safe area (`max(left, right)` inset both sides; the bottom 21 px never touchable);
  scaled by `clamp(h / 390, 0.85, 1.15)` × S/M/L; never drawn under 52 px; touch box = drawing + 10 px each side.
- Each control is an element whose box is its touch area. `touchstart` is non-passive and calls `preventDefault`
  (no zoom, magnifier, ghost mouse events, and Phaser's window listener ignores the touch). A touch belongs to the
  element it landed on, by id, until it ends; `touchcancel` releases without acting.
- The stick zone is the thumb's 45% of the window, the black gutter included, below the top 20% (HUD) and above the
  bottom strip. The stick appears where the thumb lands, follows it past the rim, 8 px radial dead zone, full speed at
  60% of the travel. A touch that ends within 400 ms having moved under 10 px is handed to the game as a tap at that
  point (`injectTap`: down now, up two game frames later).
- A control that has just appeared ignores presses for 160 ms. A mode change, the page hiding, rotating or losing
  focus releases everything; a finger that was down then does nothing more until it lifts.
- Per-frame DOM writes are transforms only.
- The first touch on the layer still unlocks the sound (`synth.unlock()` if there is no context yet), and every
  touchend resumes a suspended context (iPhone only allows it from a touchend).

## The shell

- `html.mobile`, the CSS in `css.ts`, `#game{display:block}` so Phaser's margins centre the canvas once (gutters 75 / 75
  on an iPhone 14 instead of 113 / 38).
- Portrait: the rotate screen. The loop sleeps and the music / sound context hold, except during the first load (the
  art keeps loading behind the screen; the loop sleeps once it is done).
- `visibilitychange` hidden / `pagehide`: release, sleep, hold sound, `G.save()`. Visible: wake, resume (the context is
  suspended then resumed 150 ms later: iPhone's "running but silent" bug).
- `visualViewport` / window resize / orientation: debounced `game.scale.refresh()` and a re-layout.
- Android: the Enter-gate touchend asks for fullscreen on `#game` (`game.scale.fullscreenTarget` is set to `#game`
  so the layer stays visible) and locks `"landscape"` (both ways round). Leaving fullscreen shows a small offer to go
  back. iPhone has no fullscreen: the Add to Home Screen guide is its route (below).
- Back gesture: one guard history entry after the Enter tap; a back swipe pauses (a second one, while paused, leaves).

## Phone settings (`settings.ts`)

One typed object, `PhoneSettings`, kept under its own key `storageKey("krelworld.phone.settings")` (JSON, `v: 1`).
The game's `Settings` / `MetaState` are never touched, so a laptop's save data is byte for byte what it was. Loading
writes nothing; a change is saved at once; storage that throws (private mode, full) is survived (the settings then last
for the visit). `installMobile()` attaches the store before anything lays itself out.

| Key | Default | Live now? | What |
|---|---|---|---|
| `leftHanded` | false | yes (layer) | stick on the right, buttons on the left |
| `buttonSize` | `"M"` | yes (layer) | S / M / L = 0.85 / 1 / 1.2 (never under 52 px) |
| `opacity` | 0.3 | yes (layer) | idle outline strength 0.2 to 0.8 |
| `stick` | `"floating"` | yes (layer) | `"fixed"`: the base stays at its resting place |
| `haptics` | true | yes (layer buttons) | `navigator.vibrate` 12 to 25 ms where it exists (Android) |
| `readability` | **false** | yes (see below) | the font floor and the tap snap |
| `textSize` | `"normal"` | yes, with readability | `"large"`: floor 12.5 CSS px |
| `batterySaver` | false | yes | 30 frames a second |
| `autoFire` | true | stage 2 | combat fires by itself at an in-range enemy |
| `aimAssist` | `"normal"` | stage 2 | `off` / `normal` (sticky auto-aim) / `strong` |
| `phoneAssist` | true | stage 2 | the forgiving touches (timing x1.25, pickup radius, jump help) |
| `syncOffsetMs` | 0 | stage 3 | rhythm offset, -300 to 300 ms |
| `playOverMyMusic` | false | stage 3 | iPhone audio session "ambient" (player's music keeps playing) instead of "playback" |

```ts
import { phoneSettings, updatePhoneSettings, onPhoneSettingsChange, phoneSettingsList, resetPhoneSettings } from "src/game/mobile";
phoneSettings().autoFire;                              // read (Readonly<PhoneSettings>)
updatePhoneSettings({ buttonSize: "L" });             // change: cleaned, saved, listeners told
const off = onPhoneSettingsChange((s, changed) => { if (changed.includes("autoFire")) ... });
for (const e of phoneSettingsList()) e.label, e.help, e.type ("toggle" | "choice" | "slider"), e.options, e.min/max/step/unit, e.live, e.get(), e.set(v)
```

A settings screen (stage 2) renders `phoneSettingsList()` and may hide rows with `live: false` until their feature is
wired; whoever wires one flips its `live` to true in `PHONE_SETTINGS`. Nothing else in the schema has to change.

## Readability (`readable.ts`, `readability.ts`): OFF until stage 2 turns it on

The canvas is 960x540 game px shown at about 0.63 to 0.72 on a phone (k = canvas CSS width / 960), so 11 px labels
end up 7 to 8 CSS px. Two phone-only mechanisms, both switched by one thing:

1. **Font floor.** Every Phaser Text is drawn at least `MIN_TEXT_CSS` = 10 CSS px (12.5 with `textSize: "large"`):
   game px floor = ceil(10 / (k x the text's scale x its containers' scale x camera zoom)). Hooked where every Text is
   (re)drawn (`Text.prototype.updateText`, plus `setScale`), so the 1,200 `add.text` calls need no edits. The size the
   game asked for is kept (`style.__mfReq`), so turning it off puts every text back exactly. Texts whose scale is
   tweening, or under 0.5 (pop-ins), are left alone until they settle; the canvas scale is re-read every 20 frames
   (Safari's bars) and upright is ignored.
2. **Tap areas of at least `MIN_HIT_CSS` = 44 CSS px.** A touch that lands on no control (or only on a backdrop: an
   interactive object covering at least 45% of the screen both ways, e.g. a tap-anywhere zone or a modal's dimmer) goes
   to the nearest small interactive object whose tap area, grown about its middle to 44 x 44 CSS px, contains it. The
   drawing never moves, a touch ON a control always goes to it, and in a gap the nearest one wins (no stealing).
   Hooked at `InputPlugin.prototype.hitTestPointer`, touches only. This covers `button()` and every other canvas control.

**The switch.** `readability` in the phone settings (default **false**), overridden for one visit by the address:
`?mobileread=1` on, `?mobileread=0` off (not stored). While it has never been on, nothing is patched at all (phone text is
exactly what it was in part 1; the smoke test checks there is no patch and no resized text). Laptops never load it.

**How stage 2 turns it on** (once its screens no longer overflow at the floor):
1. Test a screen with `?mobile=1&mobileread=1` (or `window.__krelMobile.settings.set({ readability: true })`), fix its
   layout behind `isMobile()`, and check it with `textSizes()` in `scripts/mobile-smoke.cjs` (no text under 10).
2. When every screen is done, change `readability: false` to `true` in `DEFAULT_PHONE_SETTINGS` (`settings.ts`), and
   change the smoke test's default check. Players who never touched the setting get it; anyone who turned it off keeps
   it off (their stored value wins). The settings screen's "Bigger text" row lets players turn it off.
3. Optional: `readability()?.set(true)` from code turns it on for this visit only (e.g. a single screen experiment).

## Touch wording (`wording.ts`)

`hint(text)`: touch wording on a phone, the text unchanged on a laptop. `touchWording(text)` is the pure table walk;
`TOUCH_WORDING` the table (regex → replacement, in order); `addWording(rule)` for stage 2's sweep (toasts, HUD, menus,
minigame instructions). Rules now: `E: X` / `[E] X` / `E / ATTACK: X` → `Tap: X` (per line); `Press E` → `Tap`;
`E to talk` → `Tap to talk`; `Tap / SPACE` and `SPACE / tap` → `Tap`; `SPACE or SPIN` / `SPACE / DROP` → `Tap SPIN` /
`Tap DROP`; `ESC or ✕` → `✕`; `(Esc)` → `(II)`; `WASD to walk` → `Drag on the left to walk`; a caption that is only keys
(`Space / E / click`, `Tab`, `Esc`, `Enter`) → nothing.

Applied in stage 1, from outside the scenes (`PromptWording`): the interact prompt Text (`scene.prompt`) of Home, Hub,
Club, Kreddle and the Venue (every `setText` on it goes through the table; the scene's own text stays in `__krelRaw`, which
is what ACTION reads its verb from); and texts created in Polson Towers (the clue prompt), the Krezz Arms (key captions
on its buttons and the Leave card), Kreddle (the machine panels' SPACE lines) and Home (the panels' "ESC or ✕ to close")
when they match that scene's `UI_TEXTS` patterns. **Never** dialogue or story text: lines characters say that mention
keys are left exactly as they are (listed in the stage reports).

## The Add to Home Screen guide (`homeScreen.ts`)

A DOM card inside `#game` (visible in Android fullscreen), landscape first (844x390, 740x360, 750x340 all fit without
scrolling) with an upright layout for the turn-your-phone screen. Steps per browser (`guideVariant(platform)`):
`ios-safari`, `ios-chrome`, `ios-edge`, `ios-firefox`, `ios-other`, `in-app` (Instagram, Facebook, Messenger, TikTok,
Snapchat, WhatsApp, X, ... and Android WebViews: "Open in Safari / Chrome first", COPY LINK), `android-chrome`,
`android-edge`, `android-samsung`, `android-firefox`, `android-other`; each step has a drawn icon (SVG). Android:
`beforeinstallprompt` is kept from page load (`listenForInstallPrompt()`) and the main button becomes INSTALL
(`prompt()` in the touchend); without it, written steps; a FULL SCREEN NOW button when the tab is not fullscreen.
Saves: iPhone "Add it FIRST: saves made in the browser stay in the browser" (or, with a save here, what happens to it);
Android "Your saves come with you". Shown once by itself on the first phone run when the title has been up 0.6 s
(remembered under `storageKey("krelworld.phone.homeScreenGuide")`), never when running from the home screen
(`navigator.standalone`, `display-mode: standalone`, or `display-mode: fullscreen` when no element is fullscreen);
always reachable from the title's corner button, the pause menu's row and the turn-your-phone screen's button.
`openHomeScreenGuide(from)` opens it; `homeScreenEntryWanted()` says whether to offer it.

The page's own install plumbing is unchanged and checked (index.html is never edited): manifest (relative
`start_url` / `scope` "./", so `/Krelworld/` for the main site and `/` for the ALT site), `display: fullscreen`,
`orientation: landscape`, 192 and 512 icons, `apple-touch-icon`, `apple-mobile-web-app-capable`, status bar
`black-translucent`, title "Krelworld"; Chrome reports no installability errors for either site path.

## `?mobilediag`

Add `?mobilediag` to the link (phones, or `?mobile=1&mobilediag` on a computer). Without it nothing is created. Shows
fps (`game.loop.actualFps`, the cap), textures (count, width x height x 4 estimate), decoded sound (count, samples x
channels x 4) and the audio context state, window / visualViewport / devicePixelRatio, the canvas box and scale k, the
safe-area insets the layer uses, the touch mode, phone mode and which tests decided it (`mobileWhy()`), browser and
home-screen state, readability, JS heap (Chrome only), and the last error (the crash guard's breadcrumb, or one the page
saw). Tap it to move it round the corners. The device checklist (outside the repo) tells a player what to read off it.

## Testing

```sh
npx vitest run tests/mobile          # flag, modes, layout, settings, readability, wording, home screen + diag

npx vite --port 5202 --strictPort &                       # normal build
VITE_KREL_ALT=1 npx vite --port 5212 --strictPort &       # ALT build
node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,guide,optout,desktop]
node scripts/mobile-smoke.cjs --url http://localhost:5212/

# the laptop must not change (both must end with DESKTOP FINGERPRINT: OK)
A="--url http://localhost:5202/ --alt-url http://localhost:5212/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt
npx vitest run tests/desktopInvariants.test.ts
```

On a phone (or devtools device emulation) `window.__krelMobile` has `snapshot()`, `view()`, `layer`, `shell`,
`setInsets({top,right,bottom,left})` (emulators report no safe-area insets; `{0,47,21,47}` is an iPhone 14
home-screen app), `settings.get() / set(patch) / list()`, `readability`, `guide`, `diag`, `plumbing()` and
`fakeInstallPrompt(outcome)` (dispatches a `beforeinstallprompt` the way Chrome would). It exists on phones only.

`?mobile=1` in a desktop browser without device emulation shows the layout, but the layer listens to touch events
only (mouse does not drive the stick) and the dungeon then has no touch pad: use devtools device emulation.

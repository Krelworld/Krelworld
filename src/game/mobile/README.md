# Phone mode (`src/game/mobile/`)

KRELWORLD on a phone held sideways. Everything phone-only lives in this folder. On a laptop (touchscreen or not), a
tablet, or in node, none of it runs: the laptop loads only `flag.ts` and `boot.ts`, which read the touch points and the
screen size and stop (no storage read, no media query on a computer without a touch screen); the rest is a separate
chunk a laptop never downloads. So the laptop game is byte-for-byte what it was (proved by
`scripts/desktop-fingerprint.cjs --check`, its `--profile` runs for the devices next to a phone,
`tests/desktopInvariants.test.ts` and `tests/desktopNotPhone.test.ts`).

## How it fits together

```
main.ts ── boot.ts installMobile(game) ──► isMobile()? no → return (nothing at all happens; nothing else is fetched)
                                            yes → import("./index") (the phone chunk) → index.ts installMobile(game):
            phone settings         its own storage key (settings.ts), loaded before anything lays itself out
            install prompt         beforeinstallprompt kept for the guide's INSTALL button (Android)
            TOUCH.enabled = true   (the game's own touch paths: wording, auto-aim, the raid's FIRE button)
            Shell  (shell.ts)      html.mobile + CSS, single centring, rotate screen, holds (sleep/wake), the carry-on
                                   card, fullscreen, back guard, notices into fullscreen
            TouchLayer (touchLayer.ts)  HTML controls inside #game, above the canvas
            HomeScreenGuide        the Add to Home Screen guide (homeScreen.ts) + the rotate screen's button; the
                                   title / pause entries reach it through boot.ts (setPhoneEntryPoints)
            Readability            font floor + 44 px taps (readability.ts), OFF unless the setting / ?mobileread=1
            PromptWording          touch wording on the walking scenes' prompts, the Enter gate, and toasts (wording.ts)
            DiagOverlay            only with ?mobilediag (diag.ts)
            game POST_STEP ──► shell.frame(); wording.frame(); rankFollowerLast(); layer.frame(); readability.frame();
                               first-run guide
                                   layer.frame():  readView(game)  ──►  resolveMode(view)  ──►  layer.apply(decision)
                                                   (observe.ts)         (modes.ts, pure)
```

| File | What it does |
|---|---|
| `flag.ts` | `isMobile()`, decided on the first call. Pure `detectPhone()` / `resolveMobile()` / `explainMobile()` for tests. `rememberPhoneMode()`, `setMobileForTests()` |
| `boot.ts` | The only phone code a laptop loads: `installMobile()` (fetches the phone chunk on a phone), and the title / pause menu's `homeScreenEntryWanted()` / `openHomeScreenGuide()` |
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
| `touchLayer.ts` | The DOM layer: floating stick, `TouchControl` / `addControl()` (ACTION, pause, SANMIK, fullscreen offer are built on it), prompt bubble and target taps, see-through, tap hand-over, `registerModeController()` |
| `shell.ts` | Page shell, rotate screen, holds (hidden / pagehide / portrait / guide / resume) and what waking needs (`wakeCare`), the carry-on card, Android fullscreen + landscape lock, back guard |
| `rotate.ts` | The "turn your phone sideways" screen (DOM, so it also covers the first load), with an empty `extra` slot |
| `css.ts` | All phone CSS, injected at runtime (index.html is never edited) |
| `index.ts` | The phone chunk's `installMobile()`, `mobileLayer()`, `mobileShell()` and re-exports |

## Deciding phone mode

Phone = touch points AND the short side of `screen` UNDER 600 CSS px (Android's phone / tablet line: the Fire 7, the
Nexus 7 and the 8-inch 1280x800 tablets all report exactly 600) AND the user agent is not Windows or ChromeOS (small
Windows tablets and handheld PCs at 150 to 200% report phone-sized screens) AND not an Android tablet (Android without
"Mobi") AND `(pointer: coarse)` AND `(hover: none)`. Cheapest first, stopping at the first "no": a laptop without a
touch screen reads two numbers and nothing else; a touchscreen laptop or a tablet stops at its size or its user agent.
Decided once, on the first `isMobile()` call (main.ts makes it right after creating the game).

The address, for development and as an escape hatch (`parseMobileParam`):

| `?mobile=` | Does | Stored? |
|---|---|---|
| `1`, `on`, `true`, `yes`, `phone` | phone mode on for this page load, only on a device with touch points (devtools device emulation); ignored on a computer with no touch screen, so a shared test link can't put a laptop into phone mode | never (a phone's earlier `0` is cleared) |
| `0`, `off`, `false`, `no`, `desktop`, `laptop`, `pc`, `computer` | today's game (the old canvas pad everywhere) | `"0"` under `storageKey("krelworld.mobile")` (the ALT build keeps its own) |
| `auto`, `reset` | forget the stored choice; the device decides | cleared |
| empty, or anything else | ignored, as if absent | – |

A stored `"1"` (left by an earlier build) is ignored. Storage is read only when it can matter: with a `?mobile=` choice,
or when the device tests say phone (to see whether the player opted out). `rememberPhoneMode("off" | "auto")` is for a
future "Phone controls: off" row in the phone settings page (takes effect on the next load). Foldables: decided at load
(folded = phone, unfolded = tablet) until the next load.

## Rules for hooks outside this folder

1. Only `if (isMobile()) …` / `isMobile() ? a : b` guards, and imports with no side effects.
2. Prefer observing from here (add an adapter in `observe.ts` and a row in `SCENE_RULES`) over editing a scene.
3. Never touch `index.html`, the scene list or the Phaser config in `main.ts`.
4. No dialogue or story text changes. UI wording for touch goes through a helper (stage 2), phones only.
5. Use `storageKey()` for any storage key. No listener, global, element, style or storage write on a laptop.

Hooks that exist now (stage 1):

| Where | What | Why |
|---|---|---|
| `src/game/scenes/TitleScene.ts` `fullscreenButton()` | `if (isMobile()) { if (homeScreenEntryWanted()) button(... "📲 ADD TO HOME SCREEN" ... openHomeScreenGuide("title")); return; }` (imports from `mobile/flag` and `mobile/boot`) | The title's corner opens the Add to Home Screen guide on a phone, replacing FULLSCREEN and the one-line iPhone hint (so it never shows twice). Laptops: unchanged |
| `src/game/scenes/MenuScene.ts` pause rows | `isMobile() && homeScreenEntryWanted() ? ["📲 ADD TO HOME SCREEN", () => openHomeScreenGuide("pause")] : [the FULLSCREEN row as it was]` (imports from `mobile/flag` and `mobile/boot`) | The guide from the pause menu, same row count (no layout change). Laptops: unchanged |
| `src/main.ts` | `import { installMobile } from "./game/mobile/boot"` and `installMobile(game)` right after the game is created | The one entry point. On a phone it fetches the phone chunk at once (the rotate screen covers the load from then on). The invariants test ignores install calls named *mobile* |
| `src/game/scenes/UIScene.ts` `setupTouch()` | `if (isMobile() && this.mode !== "dungeon") { destroy the old pad; return; }` | On phones the town / interior controls are this layer, drawn above every scene (blocker B1: the old pad was drawn under Home, the Club, Kreddle and the Venue). The old pad still runs combat until stage 2 |

Things the phone chunk does to the running game from outside (phones only, no scene file edited): the walking scenes'
prompt Texts and a few UI Texts get touch wording (`wordText`); "toast" events are reworded before the UI scene draws
them; the Hub's follower's `enabled()` is wrapped so "Shove Mikey" ranks below anything else in range
(`rankFollowerLast`, observe.ts); the old pad's stick / ATTACK are zeroed when everything lets go
(`releaseLegacyPad`).

## Modes

`none · walk · combat · side · brawl · tap` (see `modes.ts`). The mode is worked out **every frame** from what is on
screen, never switched by a scene, so it cannot get stuck (research M11). The table (`SCENE_RULES`, first match wins,
topmost running scene per rule):

| Running scene | Mode | Pause | Live |
|---|---|---|---|
| Boot, Enter, Title, CharSelect, Difficulty, Banter, ChapterSelect, DebugSkip, Menu, Slots, WeaponPick, Dialogue, Meeting, Cutscene, Vignette, TV, Archive, KrazyFact, Exile, Ending, Tutorial, Lair, RoofCutscene, KrelCue, `__p3d*` | none | – | – |
| Minigame, Whack, Drive, BeepBeep | tap | – (stage 3) | yes |
| Pub, Pit, PitLoan, PolsonHome | none | – | – |
| Finale | brawl (legacy pad) | – | yes |
| Dungeon | combat / side (legacy pad); none while busy | the canvas pad's II; the back gesture uses the Esc path | yes |
| Home, Hub | walk (none while busy) | `edge`: the scene's own Esc path | – |
| Club, Kreddle, Venue | walk (none while busy or a machine is open) | `menu`: the pause menu over the scene (on a laptop Esc walks you out; each has an exit to walk to) | – |
| Kreddle with the raid / rout running | walk | `edge` (their own Esc → pause menu) | yes |
| Hub with the shoving match running (`sub: "shove"`) | walk, ACTION = SHOVE (no prompt shows) | `edge` | – |
| anything else | none | – | – |

`ModeDecision` = `{ mode, scene, pause, pauseButton, action, sanmik, legacyPad, live, stick, ...anything a rule adds }`.
`legacyPad: true` means the canvas pad in the UI scene does this mode and the layer must not take a single touch (all its
elements are `pointer-events:none`, verified in combat). `live`: leaving the game running here can cost health (see the
shell: coming back never drops into it). `stick`: `"2d"`, `"x"` (left / right only, full speed at 35% of the travel,
research M6) or null; the stick zone takes touches only when it is set (`.kt.stick`). Two decisions are the same only if
every field is (`sameDecision` compares all own keys), so a field a stage 2 rule adds reaches the controllers.

ACTION's word: `verbFromPrompt` (the prompt's first word when it is a known verb, else USE), after `VERB_OVERRIDES`
(the bridge both ways GO, Polson Towers VISIT, the Kreddle Exchange ENTER, the machines PLAY / SPIN, vending BUY,
Rummage SEARCH, Inspect / Examine LOOK). The word is fitted to 70% of the face (measured, never under 10 px).

### Adding a mode or controls (stage 2 and later)

```ts
import { addSceneRule, registerModeController, mobileLayer } from "../mobile";

// 1. decide it: a row in front of the stage 1 rows (any extra field you return reaches your controllers)
addSceneRule({ name: "dungeon v2", match: (k) => k === "Dungeon",
  decide: (s) => (s.busy ? { mode: "none" } : { mode: s.side ? "side" : "combat", legacyPad: false, live: true, stick: s.side ? "x" : "2d", pause: "edge", pauseButton: true }) });

// 2. draw and drive it (several controllers may serve one mode; the same id again replaces one, with a warning)
registerModeController({ id: "combat-hud", mode: "combat",
  enter: ({ layer }) => {
    fire = layer.addControl({ id: "fire", slot: "prime", label: "FIRE", haptic: "press",
      onDown: () => { TOUCH.attack = true; }, onUp: () => { TOUCH.attack = false; },
      onSlide: (c, dx, dy) => { /* slide-to-aim */ } });
    fire.show(true);
  },
  frame: ({ layer, game, decision }) => { /* per frame: transforms / class toggles only */ },
  layout: ({ layer }) => { /* only for things that are not TouchControls (those are re-placed by the layer) */ },
  release: () => { /* zero every held input that is not a TouchControl's (page hidden, rotated, blur) */ },
  rearm: () => { /* after a release, when input may work again */ },
  leave: ({ layer }) => layer.removeControl("fire") });
```

`layer.addControl(spec)` gives a control everything the built-in buttons have: its element is its touch area (drawing +
10 px), a touch belongs to it by id until it ends, it ignores presses for 160 ms after it appears, the pressed ring, the
buzz, `onDown` / `onUp({ cancelled, ms })` (inside the touchend, so fullscreen is allowed there) / `onSlide(dx, dy)`, it
is re-placed on every layout (resize, Safari's bars, left-handed, S/M/L), and it goes see-through when the player or the
prompt's target is under it (`fade: false` to opt out). When the layer lets go (hidden, upright, blur, mode change), a
finger that was down does nothing more until it lifts, while a new finger works at once (tracked by touch id).

Turn the old pad off for a mode with the same guarded line in `UIScene.setupTouch` (drop the `this.mode !== "dungeon"`
condition). Feed the game through `TOUCH` (`mx/my`, `attack`, `edges`, `held`) as the old pad did. Note:
`Controls.aim()`, `aimPoint()` and `attackHeld()` test `activePointer.wasTouch`, which a DOM control does not set: combat
needs a guarded hook there (audit section 3). **Decide before wiring aim assist**: the game already has
`G.meta.settings.autoAim` (its "Touch aim assist" row shows on phones, because `TOUCH.enabled` is on), and the phone
settings have `aimAssist` (off / normal / strong). Recommended: on phones the combat hook reads `phoneSettings().aimAssist`
only, and the phone settings page is the one place to change it (the game's row stays as it is for tablets).

To read more of a scene, add an adapter to `ADAPTERS` in `observe.ts` (`busy`, where its `prompt` Text lives, `side`,
`sub`), and to `promptTarget` for tap-the-thing (Home, Hub and Kreddle have it). To act on the game use
`pressInteract()`, `pressPause()`, `pressSanmik()` (the same `TOUCH.edges` the canvas pad sends), or
`layer.injectTap(clientX, clientY)` to hand the game a real tap.

## Input rules the layer keeps

- Real CSS px, anchored to the safe area (`max(left, right)` inset both sides; the bottom 21 px never touchable);
  scaled by `clamp(h / 390, 0.85, 1.15)` × S/M/L; never drawn under 52 px; touch box = drawing + 10 px each side.
- Each control is an element whose box is its touch area. `touchstart` is non-passive and calls `preventDefault`
  (no zoom, magnifier, ghost mouse events, and Phaser's window listener ignores the touch). A touch belongs to the
  element it landed on, by id, until it ends; `touchcancel` releases without acting.
- The stick zone is the thumb's 45% of the window, the black gutter included, below the top 20% (HUD) and above the
  bottom strip, in a mode with a `stick`. Nothing inside it takes touches but the zone (research M4): a touch that
  starts there is the stick the moment it moves. The stick appears where the thumb lands, follows it past the rim, 8 px
  dead zone, full speed at 60% of the travel (35% for an "x" stick).
- A touch in the zone that ends within 400 ms having moved under 10 px is a tap: on the prompt bubble, or on the thing
  the prompt is about (around its spot, reaching further up than down: the TV, the console, a door, a person), it is
  ACTION; anywhere else it is handed to the game as a tap at that point (`injectTap`: down now, up two game frames
  later). Outside the zone, the bubble and the target have their own tap areas (only the parts outside the zone, below
  the HUD strip): a quick still tap there is ACTION, a drag nothing.
- A control the player, the prompt bubble or the prompt's target is under goes see-through in place (research C9):
  no background, a faint ring, the word still readable; it still works and still shows its pressed state. Nothing moves
  (the thumb keeps its place).
- The idle stick (and MOVE under it) shows until the player has walked with it; then it fades away 2.5 s after the
  thumb lifts (a tap doesn't bring it back).
- A control that has just appeared ignores presses for 160 ms. A mode change, the page hiding, rotating or losing
  focus releases everything (the old canvas pad's stick and ATTACK too); a finger that was down then does nothing more
  until it lifts.
- Per-frame DOM writes are transforms and class toggles only, and only when something changed.
- The first touch on the layer still unlocks the sound (`synth.unlock()` if there is no context yet), and every
  touchend resumes a suspended context (iPhone only allows it from a touchend).

## The shell

- `html.mobile`, the CSS in `css.ts`, `#game{display:block}` so Phaser's margins centre the canvas once (gutters 75 / 75
  on an iPhone 14 instead of 113 / 38).
- **Holds** (`setHold(hold, on)`): the loop sleeps while any is on and wakes when the last one goes.
  - `portrait`: the rotate screen (except during the first load: the art keeps loading behind it; the loop sleeps once
    it is done). The music and the sound context hold too.
  - `hidden` (`visibilitychange` / `pagehide`): everything lets go, the sound holds, `G.save()`.
  - `guide`: the Add to Home Screen guide is open (wherever from: title, pause, the rotate screen). The music may play on.
  - `resume`: the "PAUSED · Tap to carry on" card (below).
- **Coming back** (`wakeCare(decision)`): when the loop wakes and the decision is `live` (a fight, the raid / rout, a
  minigame, the finale), it never drops straight into it: where the scene has a pause route the pause menu opens (the
  Esc path, or the menu over the scene); where it has none (the finale, the minigames, until stage 2 / 3 give them one)
  the loop stays asleep behind the carry-on card until a tap. Town and menus carry straight on.
- Visible again: wake, resume the sound (the context is suspended then resumed 150 ms later: iPhone's "running but
  silent" bug).
- `visualViewport` / window resize / orientation: debounced `game.scale.refresh()` and a re-layout.
- Android: the Enter gate acts on touch-down and fades for 650 ms; the shell notes the touches that began on the gate
  and asks for fullscreen on `#game` in that touch's touchend wherever it ends (a press held past the fade still counts),
  and locks `"landscape"` (both ways round). `game.scale.fullscreenTarget` is `#game` so the layer stays visible.
  Leaving fullscreen shows a small offer to go back. iPhone has no fullscreen: the Add to Home Screen guide is its route.
- Messages the game pins to `<body>` with `position: fixed` (the crash guard's notices) are moved into `#game`, so they
  show in Android's fullscreen.
- Back gesture: one guard history entry after the Enter tap. A back pauses where the game can pause, and does nothing
  where it can't (the title, a conversation, a menu); the guard goes straight back up (and again on the next touch, if
  the browser skipped an entry made outside a tap). A back while the pause menu is showing leaves the game.

## Phone settings (`settings.ts`)

One typed object, `PhoneSettings`, kept under its own key `storageKey("krelworld.phone.settings")`. The game's
`Settings` / `MetaState` are never touched, so a laptop's save data is byte for byte what it was. Loading writes
nothing; a change is saved at once; storage that throws (private mode, full) is survived (the settings then last for the
visit). `installMobile()` attaches the store before anything lays itself out.

**Only what the player chose is stored** (`{ v: 2, buttonSize: "L" }`, `chosenPhoneSettings()`), never the defaults, so
changing a default in `DEFAULT_PHONE_SETTINGS` later reaches everyone who never chose that setting, whatever else they
changed; a player who set it themselves keeps their choice. Reset forgets every choice. Version 1 (stage 1 part 2,
never shipped) stored every field: reading one, only the values that differ from version 1's defaults count as chosen.
Research S12: when a default changes, tell the player (a one-line toast on the next visit) rather than changing it
silently.

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
   change the smoke test's default check. Everyone who never chose that setting gets it (whatever else they changed:
   only chosen settings are stored); anyone who turned it off themselves keeps it off. The settings screen's "Bigger
   text" row lets players turn it off.
3. Optional: `readability()?.set(true)` from code turns it on for this visit only (e.g. a single screen experiment).

## Touch wording (`wording.ts`)

`hint(text)`: touch wording on a phone, the text unchanged on a laptop. `touchWording(text)` is the pure table walk;
`TOUCH_WORDING` the table (regex → replacement, in order); `addWording(rule)` for stage 2's sweep (toasts, HUD, menus,
minigame instructions). Rules now: `E: X` / `[E] X` / `E / ATTACK: X` → `Tap: X` (per line); `Press E` → `Tap`;
`E to talk` → `Tap to talk`; `Tap / SPACE` and `SPACE / tap` → `Tap`; `SPACE or SPIN` / `SPACE / DROP` → `Tap SPIN` /
`Tap DROP`; `ESC or ✕` → `✕`; `(Esc)` → `(II)`; `WASD to walk` → `Drag on the left to walk`; a caption that is only keys
(`Space / E / click`, `Tab`, `Esc`, `Enter`) → nothing.

Rules added in round 1: `Esc for menu` → `II for the menu`; the Enter gate's `PRESS ANY KEY` → `TAP TO START` and
`OR CLICK / TAP` → nothing.

Applied in stage 1, from outside the scenes (`PromptWording`): the interact prompt Text (`scene.prompt`) of Home, Hub,
Club, Kreddle and the Venue (every `setText` on it goes through the table; the scene's own text stays in `__krelRaw`, which
is what ACTION reads its verb from); texts created in Polson Towers (the clue prompt), the Krezz Arms (key captions
on its buttons and the Leave card), Kreddle (the machine panels' SPACE lines), Home (the panels' "ESC or ✕ to close")
and the Enter gate (its two captions) when they match that scene's `UI_TEXTS` patterns (also texts already built when
the phone chunk arrived); and every `G.emit("toast", ...)` title and text (system hints: "KRELFORD: WASD to walk..." →
"Drag on the left to walk. Tap to talk/interact... II for the menu", "(Esc)" → "(II)", "Press E to shove" → "Tap to
shove"), never `"ping"` (characters' messages). **Never** dialogue or story text: lines characters say that mention
keys are left exactly as they are (listed in the stage reports), and so is Home's narrated "TIP: WASD / arrows..."
line (it goes through the dialogue box).

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
`openHomeScreenGuide(from)` opens it; `homeScreenEntryWanted()` says whether to offer it (the title and pause menu
call boot.ts's versions, which answer "no" until the phone chunk is in).

Round 1: in an app's own browser (Messenger, Instagram...) the in-app card shows itself straight away, over the loading
or the turn-your-phone screen (its dismiss button says PLAY HERE ANYWAY). Android steps that go through the browser's
own menu (written steps, the in-app card) leave the game's fullscreen while they show (fullscreen hides that menu);
closing the guide with a tap goes back in. The iPhone Safari card adds "No Add to Home Screen in the list? Tap the
compass (or "Open in Safari") first" (an app's Safari preview sheet); the in-app card names "Open in external browser"
(Instagram). The game sleeps under the guide (the `guide` hold).

The page's own install plumbing is unchanged and checked (index.html is never edited): manifest (relative
`start_url` / `scope` "./", so `/Krelworld/` for the main site and `/` for the ALT site), `display: fullscreen`,
`orientation: landscape`, 192 and 512 icons, `apple-touch-icon`, `apple-mobile-web-app-capable`, status bar
`black-translucent`, title "Krelworld"; Chrome reports no installability errors for either site path.

## `?mobilediag`

Add `?mobilediag` to the link (phones, or `?mobile=1&mobilediag` on a computer with devtools device emulation). Without
it nothing is created. Shows fps (`game.loop.actualFps`, the cap), textures (count, width x height x 4 estimate), decoded
sound (count, samples x channels x 4) and the audio context state, window / visualViewport / devicePixelRatio, the canvas
box and scale k, the safe-area insets the layer uses, the touch mode, phone mode and which tests decided it
(`mobileWhy()`: worked out when asked), browser and home-screen state, readability, JS heap (Chrome only), and the last
error (the crash guard's breadcrumb, or one the page saw). It starts on the right below pause and lets every touch
through to the game (you can play the device checklist with it up); only its MOVE tab takes touches, to move it round
the corners. The device checklist (outside the repo) tells a player what to read off it.

## Testing

```sh
npx vitest run tests/mobile tests/desktopNotPhone.test.ts   # flag, modes, layout, settings, readability, wording, home screen + diag; the not-a-phone devices

npx vite --port 5202 --strictPort &                       # normal build
VITE_KREL_ALT=1 npx vite --port 5212 --strictPort &       # ALT build
node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,guide,optout,town,dungeon,android,desktop]
node scripts/mobile-smoke.cjs --url http://localhost:5212/

# the laptop must not change (both must end with DESKTOP FINGERPRINT: OK)
A="--url http://localhost:5202/ --alt-url http://localhost:5212/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt
npx vitest run tests/desktopInvariants.test.ts
# and the devices next to a phone (after any change to the detection or a guarded scene hook)
for p in touchlaptop ipad fire7; do node scripts/desktop-fingerprint.cjs --url http://localhost:5202/ --no-alt --profile $p --only front,newgame --check; done
node scripts/desktop-fingerprint.cjs --url http://localhost:5202/ --no-alt --profile androidtab --only front,newgame,hub --check
```

On a phone (or devtools device emulation) `window.__krelMobile` has `snapshot()`, `shellState()`, `view()`, `layer`,
`shell`, `setInsets({top,right,bottom,left})` (emulators report no safe-area insets; `{0,47,21,47}` is an iPhone 14
home-screen app; CDP `Emulation.setSafeAreaInsetsOverride` plus a resize drives the real `env()` path), `settings.get() /
set(patch) / list()`, `readability`, `guide`, `diag`, `plumbing()` and `fakeInstallPrompt(outcome)` (dispatches a
`beforeinstallprompt` the way Chrome would), and `api` (`registerModeController`, `unregisterModeController`,
`addSceneRule`, `SCENE_RULES`, `verbFromPrompt`: the game's own module instances, for tests). It exists on phones only.

`?mobile=1` in a desktop browser needs device emulation (touch points); without it the address is ignored. With it the
layout shows, but the layer listens to touch events only (mouse does not drive the stick) and the dungeon then has no
touch pad.

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
            Readability            font floor + 44 px taps (readability.ts), ON by default ("Bigger text")
            PromptWording          touch wording on the walking scenes' prompts, the Enter gate, and toasts (wording.ts)
            DiagOverlay            only with ?mobilediag (diag.ts)
            PhoneSettingsPage      the Phone settings page (settingsPage.ts)                       ┐ stage 2,
            PhoneScreens           the menus laid out for thumbs and the bigger text (screens.ts)  │ part 1
            PhoneDialogue          SKIP / LOG / AUTO, choices, reading size, Back (dialogue.ts)    ┘
            PhoneLists             the long lists as native-scroll phone lists (listScenes.ts)    ┐ stage 2,
            PhoneShops             every shop: tiles, detail, BUY, ammo by the box (shops.ts)      ┘ part 2
            game POST_STEP ──► shell.frame(); wording.frame(); rankFollowerLast(); layer.frame(); readability.frame();
                               dialogue.frame(); lists.frame(); shops.frame(); first-run guide
                                   layer.frame():  readView(game)  ──►  resolveMode(view)  ──►  layer.apply(decision)
                                                   (observe.ts)         (modes.ts, pure)
```

| File | What it does |
|---|---|
| `flag.ts` | `isMobile()`, decided on the first call. Pure `detectPhone()` / `resolveMobile()` / `explainMobile()` for tests. `rememberPhoneMode()`, `setMobileForTests()` |
| `boot.ts` | The only phone code a laptop loads: `installMobile()` (fetches the phone chunk on a phone), and the title / pause menu's `homeScreenEntryWanted()` / `openHomeScreenGuide()` |
| `platform.ts` | iPhone / Android / home-screen app / in-app browser (pure `platformFrom()`) |
| `settings.ts` | The phone's own settings: one typed object, defaults, its own storage key, change listeners, and `phoneSettingsList()` (the typed list a settings screen renders) |
| `readable.ts` / `readability.ts` | Readability: the phone-only font floor (labels 11 CSS px, menu buttons 12.5, speaker names 14, reading text 16) and 44 CSS px tap areas. On by default (stage 2) |
| `dialogue.ts` / `dialogueLogic.ts` | Conversations (stage 2): SKIP / LOG / AUTO (and II) pills, the reading size and pagination fed to the game's dialogue box, choices for thumbs, Android Back; the pure rules (AUTO timing, the choice guard, choice placement, Back) |
| `screens.ts` | The menus laid out for a phone from outside (title, pause menu, settings, death / difficulty / banter pages, character select, Difficulty, Banter, save slots, the telly's subtitles and captions, Home's group chat) |
| `settingsPage.ts` | The Phone settings page (DOM): every phone setting, Phone layout Auto / On / Off, "a Bluetooth controller works" |
| `lists.ts` / `listLogic.ts` | The phone list (stage 2 part 2, research M10): a DOM card over the canvas with native momentum scroll, 52 px rows, 44 px tabs and ▲ ▼ page buttons, taps on release, the selected row in view, a drag handle to reorder, tiles and a detail column with BUY and − / + (shops); the pure rules (paging, scroll-into-view, drop slot, boxes of ammo, character select's second tap) |
| `listScenes.ts` | Which game lists become phone lists and what a tap does there: the TV guide, the gun rack, the jukebox, the Kreltality trophies, the loaner rack, the archive, QUESTS, the DIALOGUE LOG, chapter select |
| `shops.ts` | Every shop (ui/shop.ts's ShopGrid: the Kreddle Exchange, the Prize Counter, Home Furnishings) as a phone list of tiles and a detail with BUY (research S13) |
| `cues.ts` | First-time cues: the idle stick and ACTION pulse until first used (remembered per phone) |
| `domTap.ts` / `canvasUi.ts` | Helpers: taps on the phone's DOM pieces (acts on touchend, never during a scroll); resizing the game's canvas buttons with their tap areas |
| `wording.ts` | Touch wording: `hint()` and the `TOUCH_WORDING` table ("E: Talk" → "Tap: Talk"); applied to the walking scenes' prompts. `NARRATOR_TIPS` / `narratorTip()`: the narrator's control tips (stage 2) |
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

Stage 2 (part 1) added **no hook in any game file**. It wraps, once, from the phone chunk (each wrapper calls the
game's own method first and only then lays out what it built; a laptop never loads any of it):

| Wrapped | By | Does (phones only) |
|---|---|---|
| `DialogueBox.prototype` `play`, `destroy`, `renderLine`, `shownText`, `showNotify`, `showChoices`, `showReaction`, `clearOverlay`; the static `DialogueBox.layout` | `dialogue.ts` | tracks the conversation on screen; reading sizes and the box's page size; narrator tips in touch wording; choices / reactions for thumbs (never a word changed) |
| `MenuScene.prototype.render` | `screens.ts` | the pause menu (and its 📱 PHONE SETTINGS row), settings (and its 📱 PHONE tab), death / difficulty / banter / tribunal pages, every page's bottom buttons |
| `TitleScene.prototype.create` | `screens.ts` | the title menu in two columns of 44+ px rows; ADD TO HOME SCREEN 44 px |
| `CharSelectScene.prototype.create` / `select` | `screens.ts` | the smaller face grid, the wider details panel re-flowed, ◀ BACK top left, PLAY AS under the grid |
| `SaveSlotsScene.prototype.render` | `screens.ts` | slot rows re-stacked for the bigger text, 🗑 and BACK 44 px |
| `HomeScene.prototype.laptopPanel` | `screens.ts` | the group chat at reading size |
| each scene's `create` event (Difficulty, Banter, TV) | `screens.ts` | the Difficulty / Banter cards; the telly's subtitles as reading text, its key captions in touch wording |

Stage 2 part 2 added **no hook in any game file** either. It wraps, once, from the phone chunk:

| Wrapped | By | Does (phones only) |
|---|---|---|
| `TVScene.prototype.drawGuide` | `listScenes.ts` | reads the channel codes and the TV log line off what the game drew, hides the canvas guide under the phone list |
| `HomeScene.prototype` `panel`, `gunRackPanel`, `jukeboxPanel`, `trophyPanel` | `listScenes.ts` | remembers the open panel (title, close); hides the rack's / jukebox's / trophies' canvas rows under the phone list |
| `PitLoanScene.prototype.render`, `ArchiveScene.prototype` `renderList` / `showEntry` | `listScenes.ts` | the loaner rack and the archive's record list under the phone list |
| `MenuScene.prototype.render` (after screens.ts's wrapper) | `listScenes.ts` | QUESTS (the lines the page drew) and the DIALOGUE LOG as phone lists |
| `DebugScene.prototype` `draw` / `drawBosses` (Chapter Select and the debug menu) | `listScenes.ts` | the page's buttons under the phone list (a tap picks, START goes) |
| `ShopGrid.prototype` `setItems`, `refresh`, `celebrate`, `deny` | `shops.ts` | the cards and BUY bar under the phone list; the purchase feedback said by the list |
| `CharSelectScene.prototype.create` (screens.ts's wrapper) | `screens.ts` | P16: a tap on a face picks it, PLAY AS starts (or a second tap on the same face) |
| `TitleScene.prototype.askPassword` | `screens.ts` | the Chapter Select password box in the top quarter (above a landscape keyboard), the text box 44 px |
| the Lair's and RoofCutscene's `create` event | `screens.ts` | "Esc: skip scene" becomes a SKIP SCENE ▸▸ button (the scene's own `finish(true)`, as Esc) |

The pause menu is laid out from whatever buttons it has (two or three columns), so a row another stage adds (the
combat controls' CONTROLS page) needs nothing here.

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
- Back gesture: one guard history entry after the Enter tap. Phone overlays answer first (`addBackHandler`: the
  Phone settings page, the guide, then the conversation: its LOG closes, a meeting / cutscene / vignette pauses). Then
  a back pauses where the game can pause, and does nothing where it can't (the title, a town conversation, a menu);
  the guard goes straight back up (and again on the next touch, if the browser skipped an entry made outside a tap). A
  back while the pause menu is showing leaves the game.

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
| `readability` | **true** (stage 2) | yes (see below) | "Bigger text": the font floor and the reading sizes |
| `textSize` | `"normal"` | yes, with readability | `"large"`: every floor x1.25 (labels 13.75, reading 20 CSS px) |
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

The Phone settings page (`settingsPage.ts`, stage 2) renders `phoneSettingsList()`, every row whether `live` or not;
whoever wires one flips its `live` to true in `PHONE_SETTINGS`. Nothing else in the schema has to change.

## Readability (`readable.ts`, `readability.ts`): ON since stage 2

The canvas is 960x540 game px shown at about 0.63 to 0.72 on a phone (k = canvas CSS width / 960), so 11 px labels
end up 7 to 8 CSS px. Two phone-only mechanisms:

1. **Font floor** (the "Bigger text" setting). Every Phaser Text is drawn at least `MIN_TEXT_CSS` = 11 CSS px (x1.25
   with `textSize: "large"`): game px floor = ceil(11 / (k x the text's scale x its containers' scale x camera zoom)).
   Texts with a role get more: `markReading(text, role)`: `"read"` 16 CSS px (`READ_TEXT_CSS`: dialogue body, choices,
   Messenger pings and reactions, TV subtitles, the laptop's group chat), `"name"` 14 (speaker names), `"button"` 12.5
   (the words on menu buttons). Hooked where every Text is (re)drawn (`Text.prototype.updateText`, plus `setScale`),
   so the 1,200 `add.text` calls need no edits. The size the game asked for is kept (`style.__mfReq`), so turning it
   off puts every text back exactly. Texts whose scale is tweening, or under 0.5 (pop-ins), are left alone until they
   settle; the canvas scale is re-read every 20 frames (Safari's bars) and upright is ignored. Layouts that depend on
   it (screens.ts, dialogue.ts) are told through `readability().onChange()` and redraw the open menu.
2. **Tap areas of at least `MIN_HIT_CSS` = 44 CSS px** (always on in phone mode, whatever the text size). A touch
   that lands on no control (or only on a backdrop: an interactive object covering at least 45% of the screen both
   ways, e.g. a tap-anywhere zone or a modal's dimmer) goes to the nearest small interactive object whose tap area,
   grown about its middle to 44 x 44 CSS px, contains it. The drawing never moves, a touch ON a control always goes to
   it, and in a gap the nearest one wins (no stealing). Hooked at `InputPlugin.prototype.hitTestPointer`, touches
   only. screens.ts spaces the menus so every control gets its 44 px.

**The switch.** `readability` in the phone settings, default **true** since stage 2 (only chosen settings are stored,
so the flip reached everyone who never chose; anyone who turned it off keeps it off). "Bigger text" on the Phone
settings page turns it off and on, live. `?mobileread=0` / `?mobileread=1` override it for one visit (not stored).

Measured with `textSizes()` in `scripts/mobile-smoke.cjs` at 844x390, 750x340 and 740x360: no text under 11 CSS px
on the title, the settings and pause menus, character select; reading text in conversations, choices, pings and
subtitles at 16 (never under 15).

## Conversations (`dialogue.ts`): stage 2

Every conversation (the town's Dialogue overlay, meetings, cutscenes, vignettes, the Lair, interiors, the raid...) is
drawn by `ui/DialogueBox.ts`; phone mode drives it from outside. A laptop is untouched: its Space / E / click advance,
Tab skip, Esc pause and number keys are the box's own and nothing here runs.

- **Tap anywhere** advances; a tap while a line is typing completes it (the box's own rules, kept). When choices
  appear, the question is shown whole at once (a tap meant to finish it can never land on a row).
- **Pills** on the box's top edge, right end (below it when the box is at the top; inside its bottom-right corner
  while choosing): **AUTO**, **LOG**, **SKIP ▸▸**, and **II** where the scene has a pause menu (Meeting, Cutscene,
  Vignette: exactly where Esc pauses on a laptop). Each is a 44 CSS px tap area; they hide under the pause menu, the
  save slots, a broadcast, a Kreltality, the weapon picker, and while the Krezz Arms' own chat bar shows.
  - SKIP = the laptop's Tab (`box.skipAll()`): runs to the next choice, reaction, broadcast, Kreltality or the end of
    the script, every skipped line still applying its flags, sounds, callbacks and log entry; it never skips a
    choice (hidden while choosing). Single tap: what was skipped is in the LOG.
  - LOG: the lines shown since this conversation started (`dialogueLog()` from that point), in a native-scroll list
    (`overflow-y:auto; touch-action:pan-y`), newest at the bottom; ✕, a tap outside or Back closes it.
  - AUTO (for this visit; the game's own "Auto-advance dialogue" setting also counts): a voiced page moves on 700 ms
    after the voice ends (and not before half its reading time); a silent one (narration, a later page of a long
    line) after its reading time, 1.2 s + 50 ms a character, 1.5 to 8 s (`readingMs`).
- **Reading size** ("Bigger text" on): the body at 16 CSS px, the speaker's name at 14 with their title on the same
  row. The box's own pagination is fed the phone sizes (the static `DialogueBox.layout`: as many lines as fit at the
  reading size), so a long line is split into more boxes; the words are identical (the box's own sentence-end / `…`
  breaks, as on a laptop when a line is too long).
- **Choices**: rows at least 48 CSS px tall and 10 apart, 900 game px wide, reading size, no "1." in front. Above the
  box when they fit, else over the whole screen with the question above them (or, with no room, in the LOG). A row is
  picked only by a touch that went down and up on that row, at least 180 ms after the rows appeared
  (`CHOICE_GUARD_MS`). Reactions: the same guard, no key numbers, "REACT".
- **Android Back** (`backAction`): closes the LOG (or the Phone settings page, or the guide); in a meeting /
  cutscene / vignette opens its pause menu (the laptop's Esc); in a town conversation does nothing (the town is
  paused under it, and Esc does nothing there on a laptop either). It never skips: Back means "get me out", and a
  skip cannot be undone (the R3 follow-up asked whether Back should SKIP; it should not).
- **Narrator control tips**: the box's `shownText` runs NARRATOR / stage-direction lines through `NARRATOR_TIPS`
  (wording.ts). A character's line is never touched.

`window.__krelMobile.dialogue`: `snapshot()`, `current()`, `openLog()`, `entries()`, `onBack()`, `auto`, `stats`.

## Menus (`screens.ts`) and the Phone settings page (`settingsPage.ts`): stage 2

Laid out right after the game builds each screen (see the wrapped methods above): title (two columns, CONTINUE
across; ADD TO HOME SCREEN 44 px; the key line gone), pause (two or three columns of 44+ px rows with 12 px between,
the objective on its own lines above, a 📱 PHONE SETTINGS row), settings (a 📱 PHONE tab; two columns of rows with
44 px − / +; no "Lock mouse"), the death / difficulty / banter / tribunal pages (44 px rows, two columns when one
would not fit), character select (3 x 3 faces of 118 x 112, a 562 px details panel re-flowed top to bottom: no more
"Proctus covers as" over the quote), Difficulty and Banter (cards as tall as their words, ◀ top left, the notes under
the cards: on the shortest screens the how-to line and then the multipliers line step aside), save slots (four lines
a slot, 🗑 44 px). Every bottom button 44 px and above the 21 px home-indicator strip.

The **Phone settings page** is a DOM page over the game (real CSS px, safe area, native scroll on a short screen):
`phoneSettingsList()`, every row whether `live` or not, two columns of 48 px rows with the label and one line of help;
toggles (the whole row), choices (44 px segments), sliders (44 px − / +); then **Phone layout: AUTO / ON / OFF**
(`rememberPhoneMode`: OFF stores the opt-out and offers RELOAD NOW; AUTO and ON store nothing, because on a phone the
device test already says phone and flag.ts deliberately ignores a stored "1" so tablets and laptops never read
storage at startup); and "🎮 A Bluetooth controller works". RESET forgets every choice; DONE, ✕-less Back close it.
Reached from SETTINGS' 📱 PHONE tab (the title's and the pause menu's) and the pause menu's 📱 PHONE SETTINGS row.
`window.__krelMobile.settingsPage`: `open(from)`, `close()`, `isOpen`, `rows()`.

## Lists and shops (`lists.ts`, `listScenes.ts`, `shops.ts`): stage 2 part 2

Research M10: one native-scroll list for every list longer than the screen. On a phone, when the game draws one of
these lists, a DOM card goes over that part of the canvas (opaque, real CSS px, clamped above the 21 px home-indicator
strip) and the canvas rows it replaces are hidden and stop taking taps:

| List | Shows when | Tap does | Also |
|---|---|---|---|
| TV on-demand guide | the guide is up, unless it fits (7 shows or fewer and one channel) | plays that show (`TVScene.play`) | channel tabs 44 px (sideways scroll), 📺 WHATEVER'S ON, NEW / 🎁 NEW / ✓ SEEN badges, the TV log line ("Seen 6 of 65 · ...") |
| Gun rack | two or more guns | picks the gun (its stats, mods, ammo in the detail column) | reorder: drag the ⋮⋮ handle, or ⬆ ⬇ on the picked gun, or ★ MAKE IT #1 (research S11's non-drag way); ammo by the box with − / + (the game's "fill it as far as your money goes" is the starting count); 🩸 PERKS & GORE |
| Jukebox | always (90 tunes) | plays it | two columns, STOP, SHUFFLE, NOW PLAYING |
| Kreltality trophies | more than 7 | – | – |
| Loaner rack (Krunch Pit) | always | picks it | BORROW / HAND BACK / BORROW MAX on each row, GUNS / PERKS tabs, DONE |
| Historical Archive | more than 13 records | opens the record (the game's own page) | locked records dimmed |
| QUESTS (pause menu) | the page has more than fits | – | STORY / SIDE QUESTS / FACTS & STATS tabs |
| DIALOGUE LOG (pause menu) | more than 4 lines | – | opens at the newest line (the bottom) |
| Chapter Select / debug menu | always | picks a chapter, side quest or boss; **START ▸** on it goes (it replaces your save) | ◀ BACK, PLAYING AS and DIFFICULTY in the header; BOSS FIGHTS opens its page |

Every list: `overflow-y:auto; -webkit-overflow-scrolling:touch; touch-action:pan-y; overscroll-behavior:contain`;
rows 52 CSS px with 16 px words; ▲ / ▼ page buttons (44 px) beside the list when it doesn't fit (85% of the view a
press; a way that needs no drag); a tap acts on touchend and only if the finger moved under 12 px and lifted on the
same thing (so a scroll never presses a row); no touch reaches the game (`keepTouches`); it opens on the selected row
(or where you left it: the scroll position is remembered per list and tab) and keeps the selected row in view when the
selection moves. Android Back closes a Home panel's list and the loaner rack (what Esc does there).

**Shops** (research S13): every ShopGrid on a phone is a scrolling grid of tiles (every item, no pages) with the picked
item's detail beside it (icon, name, words, level, ammo) and one **BUY** button (52 px, above the home-indicator strip).
A tap on a tile only picks it: on a laptop a second click on a card buys, on a phone only BUY buys. Per-gun ammo is
bought by the box with − / + (it starts at the game's fill-as-far-as-your-money-goes count). The exact count goes through
the game's own purchase: for that purchase the purse holds n boxes' worth and the rest is put straight back (a save
inside it waits until the money is all back). The shop's header, tabs, balances and ✕ stay the game's own (tap areas
44 px through the readability tap snap). There is nothing to sell or discard in the game's shops; the pause menu's SAVE
GAME and QUIT TO TITLE are 12 px apart (part 1); chapter select, which replaces your save, asks for a second tap
(START).

**Character select (P16)**: a tap on a face picks them and shows their details (PLAY AS gives a little nod); PLAY AS
starts. A second tap on the face you tapped also starts (as on Difficulty and Banter), at least 300 ms after the first;
the face that starts selected never starts on one tap; a finger that slides off a face does nothing.

`window.__krelMobile.lists`: `open()` (the list showing: name, rows, scroll), `host` (`lists`, `rack`), `shops`.

## Walking comfort (stage 2)

- The idle stick's ring never sits over the player (the gate's note: 750x340, Home's far left): `ghostClear()`
  moves a floating stick's hint beside or above the player inside the stick zone; a fixed stick stays put and goes
  see-through.
- First-time cues (research S10, `cues.ts`): the idle stick pulses until the player has walked with it, ACTION
  pulses until it is pressed once; remembered under `storageKey("krelworld.phone.cues")`.

## Touch wording (`wording.ts`)

`hint(text)`: touch wording on a phone, the text unchanged on a laptop. `touchWording(text)` is the pure table walk;
`TOUCH_WORDING` the table (regex → replacement, in order); `addWording(rule)` for stage 2's sweep (toasts, HUD, menus,
minigame instructions). Rules now: `E: X` / `[E] X` / `E / ATTACK: X` → `Tap: X` (per line); `Press E` → `Tap`;
`E to talk` → `Tap to talk`; `Tap / SPACE` and `SPACE / tap` → `Tap`; `SPACE or SPIN` / `SPACE / DROP` → `Tap SPIN` /
`Tap DROP`; `ESC or ✕` → `✕`; `(Esc)` → `(II)`; `WASD to walk` → `Drag on the left to walk`; a caption that is only keys
(`Space / E / click`, `Tab`, `Esc`, `Enter`) → nothing.

Rules added in round 1: `Esc for menu` → `II for the menu`; the Enter gate's `PRESS ANY KEY` → `TAP TO START` and
`OR CLICK / TAP` → nothing.

Rules added in stage 2: the dialogue footer `▼ E / Space · Tab skip` → `▼`; `REACT (1-5 or click)` → `REACT`; the
Difficulty / Banter how-to line → `Tap one, then tap it again to go on / start`; the title's key line and the telly's
key captions (`Space / click`, `Tab`, `D`, `Esc`) → nothing; the save slots' key hints → `Tap a slot to load it` / gone.

Rules added in stage 2 part 2 (the sweep): "(E)" → "(tap)"; "and press E to" → "and tap to" (the playground);
"(↑ / ↓)" → nothing (Kreddle's kards: its buttons say HIGHER / LOWER); "SKIP ▶▶  (Tab)" → "SKIP ▶▶" (Home's book);
"←/→ (or tap ◀ ▶) sets the Heat:" → "Tap ◀ ▶ to set the Heat:" (the Krunch Pit); the ending's "(click, or press 1 · 2 ·
3 · 4)" / "(click, or press 1 / 2)" → "(tap one)", "click to skip" → "tap to skip"; the story stills' "click / Tab: skip" →
"tap: skip"; the flyovers' "SKIP ▸▸ (Space / Esc / tap)" → "SKIP ▸▸ (tap)"; "(Alt+Enter)" → nothing; the TV guide's key
line → nothing; the loaner rack's "DONE (ESC)" → "DONE" and its key line → "Tap one, then tap it again to borrow or hand
back"; the gun rack's "X swaps down the list" → "SWAP goes down the list" and its key line → nothing; "Esc: skip scene"
→ "SKIP SCENE ▸▸" (a button: screens.ts); the Exchange's "pussy juice (Q)" → "(HEAL)" and its toast "X to swap weapons"
→ "Tap SWAP to swap weapons"; character select's "Press V to become SANMIK whenever you like." → "Tap the SANMIK button
to become SANMIK whenever you like."; chapter select's "(C)" / "(V)" / "(tap to change)" → nothing.

Where: `UI_TEXTS` scenes now also **watch** every Text they make (`watchText`): a later `setText` that matches the
scene's patterns is reworded, anything else is shown as set (signs and info lines that change as you play: the
playground sign, the kards, the Pit's Heat line). In story and conversation scenes (TV, Lair, RoofCutscene, Ending, and
the stills and flyovers wherever they play) only whole UI captions are reworded, matched exactly from start to end when
the text is made: `STORY_UI_LINES` (never a text that changes later, never part of a line). The phone lists run their
own words (shop names and descriptions, quest lines) through `touchWording`. The smoke test's `wording` section walks
the menus and walking scenes and fails on any visible key or mouse name outside dialogue.

**Narrator control tips** (hard rule 3's exception; `NARRATOR_TIPS`, applied by dialogue.ts to NARRATOR /
stage-direction lines only, phones only): Home's `TIP: WASD / arrows (or the stick) to walk. E to use things.` →
`TIP: Drag on the left to walk. Tap things to use them.`; `walk up (to it) and press E` → `... and tap it`;
`and press E to` → `and tap to`; `talk to the locals (E)` → `talk to the locals (tap them)`; `Tap / SPACE` → `Tap`;
Mikey's SanMik tip `Press V (or the SANMIK button)` → `Tap the SANMIK button`, `Press it again to go back to being
you` → `Tap it again...`; the raid's `(mouse / J / the fire button)` → `(the fire button)`.
Every other word of those lines stays. The combat and side-room tips (F to headbutt, W to jump, the dungeon's CONTROLS
line, the run-and-gun legends, "walk up, press E" in boss fights) are left for the combat controls, whose button names
they would need.

Applied in stage 1, from outside the scenes (`PromptWording`): the interact prompt Text (`scene.prompt`) of Home, Hub,
Club, Kreddle and the Venue (every `setText` on it goes through the table; the scene's own text stays in `__krelRaw`, which
is what ACTION reads its verb from); texts created in Polson Towers (the clue prompt), the Krezz Arms (key captions
on its buttons and the Leave card), Kreddle (the machine panels' SPACE lines), Home (the panels' "ESC or ✕ to close")
and the Enter gate (its two captions) when they match that scene's `UI_TEXTS` patterns (also texts already built when
the phone chunk arrived); and every `G.emit("toast", ...)` title and text (system hints: "KRELFORD: WASD to walk..." →
"Drag on the left to walk. Tap to talk/interact... II for the menu", "(Esc)" → "(II)", "Press E to shove" → "Tap to
shove"), never `"ping"` (characters' messages). **Never** dialogue or story text: lines characters say that mention
keys are left exactly as they are (listed in the stage reports). Stage 2 swaps the narrator's own control tips (above),
phones only, through the dialogue box (never through `hint()` on a conversation).

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
npx vitest run tests/mobile tests/desktopNotPhone.test.ts   # flag, modes, layout, settings, readability, wording, home screen + diag, dialogue (pills, AUTO, choices, Back, page size, narrator tips, settings page, idle stick), lists (paging, reorder, boxes of ammo, character select, the wording sweep); the not-a-phone devices

npx vite --port 5202 --strictPort &                       # normal build
VITE_KREL_ALT=1 npx vite --port 5212 --strictPort &       # ALT build
node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,dialogue,settings2,lists,wording,guide,optout,town,dungeon,android,desktop]
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
`shell`, `dialogue`, `settingsPage`, `setInsets({top,right,bottom,left})` (emulators report no safe-area insets; `{0,47,21,47}` is an iPhone 14
home-screen app; CDP `Emulation.setSafeAreaInsetsOverride` plus a resize drives the real `env()` path), `settings.get() /
set(patch) / list()`, `readability`, `guide`, `diag`, `plumbing()` and `fakeInstallPrompt(outcome)` (dispatches a
`beforeinstallprompt` the way Chrome would), and `api` (`registerModeController`, `unregisterModeController`,
`addSceneRule`, `SCENE_RULES`, `verbFromPrompt`: the game's own module instances, for tests). It exists on phones only.

`?mobile=1` in a desktop browser needs device emulation (touch points); without it the address is ignored. With it the
layout shows, but the layer listens to touch events only (mouse does not drive the stick) and the dungeon then has no
touch pad.

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
| `combat.ts` | Stage 2: the top-down fights (FIRE with auto-fire and slide-to-aim, DODGE, SWAP, SPECIAL, READY, HEAL, ACTION, the weapon chip, the pocket (💨 / 🍺 / SANMIK), the mash overlay), the hooks it lends the game (`setPhoneHooks`), phone assist, the fight's touch wording |
| `aim.ts` | Pure: target choice (nearest, stick-biased, sticky, objects as a fallback), snap, lead, auto-fire's "in range, on screen, no barrel by your feet" |
| `combatLogic.ts` | Pure: READY's order, HEAL's rule, tap / hold (`HoldTracker`), SPECIAL's word and fill, the Dungeon's two mode rows |
| `combatWording.ts` | Pure: the fights' touch wording rows (the weapon picker's how-to line, the first dungeon's how-to-play rows, the finale's inject hint) |
| `combatCss.ts` | The fight controls' CSS (its own `<style>`, phones only) |
| `tapUse.ts` | Stage 3, tap to use: a tap on a thing, a person or the floor in a walking scene walks there (the scene's own walking, a grid route round the town) and uses it; the ring, its tag and the floor marker |
| `tapTargets.ts` | What can be tapped in each walking scene (Home, the Hub, Kreddle, the Club, the Venue): pictures, prompt words, where to stand, the floor, the colliders; `promptThing()` (P5) |
| `tapLogic.ts` | Pure: which thing a tap means (`pickTarget`), the grid path-finder (`buildGrid`, `findPath`), steering along the route |
| `art.ts` / `artLogic.ts` | Stage 3: the texture budget. The big one-scene pictures (`PARKED_ART`) are parked (texture kept, pixels dropped) until drawn or asked for, then fetched back from the browser's cache; parked again 30 s after their last use |
| `audio.ts` / `audioLogic.ts` | Stage 3: sound on iPhone. `new Audio()` hands out pooled elements the first tap unlocked, each through its own gain node (the volume settings work on iOS); audio session; resume checks; one song at a time; the route self-test |
| `perf.ts` / `perfLogic.ts` | Stage 3: off-screen Images / Sprites skipped when drawing, blood pools capped at 40, the player's ring in dark or crowded rooms |
| `storage.ts` | Stage 3: `navigator.storage.persist()` asked quietly (never in Firefox), a save on `freeze`; the boot's download held in an app's own browser until PLAY HERE ANYWAY |
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
| `src/game/scenes/UIScene.ts` `setupTouch()` | `if (isMobile()) { destroy the old pad; return; }` | On phones the controls are this layer, drawn above every scene: town and interiors (stage 1, blocker B1), the top-down fights and the side-scrolling rooms (stage 2; part 2 dropped the `Dungeon.side` condition) |

Hooks added in stage 2, part 1 (the top-down fights). Every one is `if (isMobile()) ...` (or `isMobile() ? a : b`), and
the phone chunk's hooks come through `boot.ts`'s `phoneHooks()`, which is null on a laptop:

| Where | What | Why |
|---|---|---|
| `src/game/combat/Controls.ts` `aim()` / `aimPoint()` | `if (isMobile()) { const a = phoneHooks()?.aim?.(scene, px, py); if (a != null) return a; }` (and the same for the aim point) | The phone's aim (auto-aim, FIRE's slide). A DOM control never sets `activePointer.wasTouch`, so the game's own touch branch couldn't be used. Null (a side room, no hook) leaves the game's code as it was |
| `src/game/scenes/DungeonScene.ts` `update()` | `if (isMobile()) phoneHooks()?.combatStep?.(this, this.controls, dt);` right before `player.update` | Target, aim, auto-fire (`TOUCH.attack`) and phone assist are worked out inside the Dungeon's frame, so the player acts on them that same frame (no frame of lag on FIRE or auto-fire) |
| `src/game/scenes/UIScene.ts` `update()` and the toast code | `phone = isMobile() && dungeon && !this.touch`: no key hints (as on touch), the gun readout hidden (the weapon chip shows it), the top-left block at phone size (HP 15 px, KREZZ + WONK % beside the bars, raised so they end above the drink chips at any text size (`phoneMetersY()`), a slim WONK bar, money beside the name, the status line under the chips), the specials prompt says `TAP WONK!` / `TAP IBS!`, the boss bar up top between the HUD and the chip (starting right of the KREZZ / WONK lines), the room name hidden under it; the toast column ends where `phoneHooks().toastRight()` says (left of pause, the fullscreen offer and the weapon chip; P10) and starts under the boss bar; the weapon card up top (`cy` 132) | DEFERRED P10, research M16 / S1. The laptop's expressions are the same numbers (`960 - w - 10`, `506`...) |
| `src/game/scenes/MenuScene.ts` settings | `if (isMobile()) { /* no row */ } else if (pk_autoaim) ... else if (TOUCH.enabled) "Touch aim assist" ...` | DEFERRED R8 item 7: one switch in one place. On a phone aiming reads only the phone setting `aimAssist`; the game's row (and the Krezz-Assist row) would be a switch that does nothing there. Tablets keep it |

Hooks added in stage 2, part 2 (side rooms, the brawl, finishers, a controller). All `if (isMobile())` / `isMobile() ? a : b`:

| Where | What | Why |
|---|---|---|
| `src/game/combat/Player.ts` `update()` side branch | `} else if (side && isMobile() && phoneHooks()?.sideMove?.(this, body, c, mv, speed, dt, now)) { } else if (side) {` (and the two imports) | The phone's jump feel (buffer, coyote, tap = hop, deliberate drop, air control, ledge pop, corner correction, platform carry) in side.ts. The laptop's branch is untouched |
| `src/game/scenes/DungeonScene.ts` one-way platform callback | `b.bottom <= pb.top + (isMobile() ? (phoneHooks()?.ledgeTol?.() ?? 14) : 14)` | Ledge forgiveness 20 px under phone assist |
| `src/game/scenes/side/SideLevel.ts` crusher and steam hit tests | `... * (isMobile() ? (phoneHooks()?.hazardScale?.() ?? 1) : 1)` (and imports) | Hazard reach x0.88 under phone assist |
| `src/game/scenes/UIScene.ts` `setupTouch()` | the `Dungeon.side` condition dropped (see the stage 1 row) | Side rooms are on the layer now |
| `src/game/scenes/finale/SsjBrawl.ts` `inputs()` | `if (this.touchUi && !(isMobile() && phoneHooks()?.brawl?.(this))) this.touchPad();` (and imports) | The brawl's big phone controls instead of its small canvas pad |
| `src/game/combat/Kreltality.ts` `prompt()` | button labels `isMobile() ? "☠ KRELTALITY" : ...` / `isMobile() ? "spare them" : ...`; `const closePhone = isMobile() ? phoneHooks()?.finisher?.(...) : null;` and `closePhone?.()` in `done()` (and imports) | No key names on a phone; one big target under the thumb (M14) |
| `src/game/combat/Controls.ts` `aim()` (inside the existing phone block) | a connected pad's right stick past 0.5 aims | A controller on the phone (S6) |
| `src/game/scenes/MenuScene.ts` `openControls()` | first line: `if (isMobile() && phoneHooks()?.controlsPicture?.()) return;` (and `phoneHooks` added to the boot import) | The Controls picture. No row added or moved, so the other builder's PHONE SETTINGS row merges cleanly |

Hooks added in stage 2, review fix round 1 (all `if (isMobile())` / `isMobile() ? a : b`; the laptop fingerprint is
unchanged):

| Where | What | Why |
|---|---|---|
| `src/game/scenes/DungeonScene.ts` `update()` | `if (!(isMobile() && this.side && !this.busy)) leadCamera(...)` | Phone side rooms: side.ts's look-ahead is the whole camera (frame-rate independent follow; F4) |
| `src/game/scenes/side/SideLevel.ts` pit respawn | `p.spr.setPosition(isMobile() ? (phoneHooks()?.pitRespawn?.(this, p.x, this.lastSafeX, this.room.w, now) ?? this.lastSafeX) : this.lastSafeX, gy - 70)` | Phone assist: put back 120 px short of the edge, the held stick waits (P2) |
| `src/game/combat/Kreltality.ts` `prompt()` | `if (closePhone) for (const o of [yesB, noB, bar]) o.setVisible(false).disableInteractive()` | One pair of targets on a phone (the phone's big two; the countdown is a ring on KRELTALITY; P7) |
| `src/game/combat/HeroPassengers.ts` `krelAllPrompt()` | the same as Kreltality: labels without (K) / (ESC), `phoneHooks()?.finisher?.({ yes, no, ms: 8000, all })`, canvas pair hidden, `closePhone()` in `done()` (and imports) | Flight KR-069's finisher on a phone (R3) |
| `src/game/combat/Wonk.ts` | title x `isMobile() ? 548 : 480` (and the flag import) | Clear of the HUD's KREZZ / WONK lines (P14) |
| `src/game/scenes/PubScene.ts` `drawMenu` | `cardStep = isMobile() ? max(72, min(96, room / rows)) : 72`, card height to match (and the flag import) | Taller cards for the bigger text (P6; screens.ts restacks the words) |

Things the phone chunk does to the running game from outside (phones only, no scene file edited): the walking scenes'
prompt Texts and a few UI Texts get touch wording (`wordText`); "toast" events are reworded before the UI scene draws
them; the Hub's follower's `enabled()` is wrapped so "Shove Mikey" ranks below anything else in range
(`rankFollowerLast`, observe.ts); the old pad's stick / ATTACK are zeroed when everything lets go
(`releaseLegacyPad`). Stage 2 (combat.ts): the Dungeon's private fields are read (enemies, breakables, pickups, shots,
busy, the player's timers), its public `swapSlow()` / `openWeaponPicker()` are called, the weapon picker's `focus()` /
`pick()` / `close()` are called for slide-to-pick and CLOSE, two Graphics (the target ring, the aim line) are added to
the Dungeon, pickups are pulled and enemy bullets drawn bigger (phone assist), Kreddle's money counter is moved left of
pause, and the Dungeon's prompt, the weapon picker's how-to line and the first dungeon's how-to-play rows get touch
wording.

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
| Minigame, Whack, Drive, BeepBeep | tap | `menu` (stage 3: the II and the pause menu) | yes |
| Pub, Pit, PitLoan, PolsonHome | none | – | – |
| Finale with the Super Saiyan brawl running (stage 2 part 2, `brawl.ts`) | brawl: the phone stick (`"2d"`), PUNCH / BLOCK / VANISH / KICK / KI; the rush is a tap anywhere | – | yes |
| Finale, any other beat | tap (stage 3; was brawl with the legacy pad, which the finale never had outside the brawl) | `card` (the II and the PAUSED card) | yes |
| WeaponPick over a top-down Dungeon (stage 2, in front of everything) | combat, `picker: true` (the thumb that opened it slides onto a gun; CLOSE where FIRE was) | – | yes |
| Dungeon, top-down room (stage 2) | combat: the phone stick (`"2d"`, gutter included), FIRE / DODGE / SWAP / SPECIAL / READY / HEAL / ACTION, the weapon chip and the pocket; `mash: true` while the WONK gauge (or the roof's group wonk) is up; none while busy (scripted moments, dying, changing rooms) | the layer's II (`edge`); none while busy (coming back shows "tap to carry on") | yes |
| WeaponPick over a side room | side, `picker: true`, stick `"x"` | – | yes |
| Dungeon, side-scrolling room (stage 2 part 2) | side: the stick `"x"` (left / right only), JUMP / FIRE / DODGE / SPECIAL / READY / HEAL / ACTION, the weapon chip and the pocket; none while busy | the layer's II (`edge`) | yes |
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

Turn the old pad off for a mode with the same guarded line in `UIScene.setupTouch` (stage 2 part 2: drop its
`Dungeon.side` condition when the side rooms get their controls). Feed the game through `TOUCH` (`mx/my`, `attack`,
`edges`, `held`) as the old pad did. `Controls.aim()` / `aimPoint()` already ask `phoneHooks().aim / aimPoint` on a
phone (combat.ts answers for top-down rooms and null elsewhere, which leaves the game's own code); a side-room
controller can answer in the same hook (extend `CombatControls.aim`, or chain `setPhoneHooks`). Aim assist is decided
(R8 item 7): on phones aiming reads only `phoneSettings().aimAssist`; MenuScene hides its "Touch aim assist" /
Krezz-Assist rows on phones (tablets keep them). Controls in a cluster share touches through `ControlSpec.group`
(`routeTouch`); a corner control can reach the screen's corner with `toCorner`; a chip places itself with `place()`.

To read more of a scene, add an adapter to `ADAPTERS` in `observe.ts` (`busy`, where its `prompt` Text lives, `side`,
`sub`), and to `promptTarget` for the thing the prompt is about (Home, the Hub and Kreddle's spots read their lists;
the Club, the Venue and Kreddle's people come from tap to use's `promptThing()`). A new walking scene gets tap to use
by a reader in `tapTargets.ts`'s `TAP_SCENES`. To act on the game use
`pressInteract()`, `pressPause()`, `pressSanmik()` (the same `TOUCH.edges` the canvas pad sends), or
`layer.injectTap(clientX, clientY)` to hand the game a real tap.

## Tap to use (`tapUse.ts`, `tapTargets.ts`, `tapLogic.ts`): stage 3

The user: "touch things at home should allow you to interact with them". In every walking scene (Home, the Hub,
Kreddle, the Club, the Venue; the Krezz Arms, the Krunch Pit, the Lair and Polson's are tap-through card screens
already), a still tap (under 10 px, under 400 ms) anywhere on the picture:

1. **A thing or a person** (the telly, the book, the gun rack, the console, the bed, a door or the whole building it
   belongs to, a vending machine, a machine row in Kreddle, the bar, a local, a band member...): a yellow ring lights it
   in the same touch handler, with the prompt's own words for it in a little tag ("Watch KrelTV"), and a light marker
   shows where the player is heading. The player walks there by the scene's own walking: tap to use only writes the
   stick's numbers (`TOUCH.mx / my`), so the speed, the drunk wobble, the slippery modifier and every collider are the
   game's. When the scene's prompt names the thing, the same edge ACTION sends uses it (`pressInteract()`) and the ring
   flashes white. Already in reach: used at once.
2. **No thing under the tap, but round the thing the prompt is about** (stage 1's generous area: around its spot,
   reaching further up than down): ACTION, as in stage 1 (the trophy shelf from just under it). A neighbour's picture
   still wins where it is; only then the floor.
3. **A canvas button of the game's own** under the tap (the Club's UP CLOSE): the game gets the tap, as before.
4. **The floor**: walk there (it felt right in research and in testing; a still tap is a deliberate act, a stray thumb
   that moves is the stick). Not from the HUD strip along the top, not onto yourself.

Which thing (`pickTarget`): each thing can be tapped within its picture grown to at least 44 CSS px, plus 6 px. Inside
a picture beats near one; among pictures the tap is inside, the smallest wins (the book lying on the bed); among near
ones, the nearest. A follower at your side (Mikey) only counts when nothing else is there. The player figure is never a
target (a thing behind the player is tapped through it). The controls win where they are drawn: with a prompt up, a tap
on ACTION is ACTION even over the console in Home's corner.

Pictures (`tapTargets.ts`): Home's spots by their words → the furniture's texture (`p_tv`, `p_bed`, `p_gunrack`...)
or a box drawn from the backdrop (the window, the door out, the poster); the town's interactables → the person's
sprite, or the spot's box joined to the collider it stands at (`standsOn`: a building, so tapping the building enters
it, a vending machine, the Tap); Kreddle's machines → every image of their texture row; the Club's places → its zones
(the stage is the dancer, the bar, the wonk-off table, the exit, the booth); people → their sprites.

The route (`findPath`): the town only (the other rooms have no colliders, just a floor to clamp to): a 16 px grid over
the physics world, each collider grown by the player's feet body; A* in 8 directions with no corner cutting, then
pulled straight where the walker can see ahead. A goal inside a collider (a door's spot under its building) moves to
the nearest free cell; with no route at all, the walk goes as near as it can and stops (the prompt shows what's there).
About 1-5 ms on the town; never more than once per tap, plus a re-route when a person walks 24 px or the walker is
stuck (no nearer by 3 px in 650 ms; twice, then it stops).

Stops at once: the stick moving past 15% of its travel (the stick takes over), a second tap (re-targets), a
conversation, a menu, a cutscene or a panel (the mode leaves "walk"), the page hiding, the thing going away, 15 s.

`window.__krelMobile.tapUse`: `state()` (walking, target, tag, path, last: what happened, stats), `debugTargets()`
(every tappable thing now, world coordinates), `tap(x, y)` (page CSS px). Smoke: `--only tapuse`.

## Fights: the top-down rooms and bosses (`combat.ts`, stage 2 part 1)

The old twelve-button canvas pad is gone from phone fights in top-down rooms and boss rooms (tablets keep it; the
`androidtab` fingerprint profile pins that). The left thumb has the town's floating stick (left 45%, the black gutter
included, P9). The right thumb has research "layout v2" (offsets from the bottom-right safe corner, scaled by
`clamp(h / 390)` x S/M/L, mirrored for left-handed play):

| Slot | Control | When | What it does (laptop key) |
|---|---|---|---|
| prime (84) | **FIRE** (crosshair) | always | hold = fire (J / left mouse), on touch-down; slide 24 px+ = aim by hand along the slide, snapping onto an enemy within 15° (25° strong), with an aim line; with auto-fire off the stream carries on 200 ms after the thumb lifts. Its touch area runs to the screen's corner |
| upLeft (60) | **DODGE** | always | dodge where the stick points (Space) |
| left (60) | **SWAP** | when there is more than one weapon with ammo | tap = next gun (X), hold 300 ms = the slow-motion weapon picker: slide onto a gun and let go; let go elsewhere and it stays up for a tap, with CLOSE where FIRE was. A thumb that moves 12 px before 300 ms cancels |
| up (60) | **SPECIAL** (the lad's word: DASH, LOAN, NEWS, OMEN, TURRET, KRUNCH, LURK, SLAM, NUKE; HEADBUTT in the troll fight) | only while it would go (enough Krezz, no decree against it); pops in, pulsing the first 2 times | the character special (F / right mouse) |
| ready (60) | **READY** (gold, pops in) | a meter ability is ready | WONK! (R) when the WONK meter is full, then GOLD (T, golden juice drunk), IBS! (G at level 4); while golden, CUME (C). Never relabelled under a thumb; ignores presses for 300 ms after a new word |
| heal (56) | **HEAL** (pops in, with the count) | a drink would heal (hurt, juice to drink, healing allowed); red and pulsing (the first 2 times) under 40% | pussy juice (Q) |
| combatAction (56) | **ACTION** (the verb) | a prompt is up | interact (E); tapping the prompt over your head works too |
| top, 24 px left of pause (140x44) | **weapon chip** (icon, name, ammo) | always | tap = next gun, hold = the picker (same as SWAP; its touch area reaches the top edge) |
| pocketFart (60, in 206 / up 186) | **💨** with its level (FAIRY / BEANS / CABBAGE) | fart level 1 to 3 (at 4 READY says IBS!) | let one rip (G) |
| pocketBongo (60, in 206 / up 266) | **🍺 BONGO** with the count | a bongo to drink | fizzy bongo (B) |
| pocketSanmik (60, in 286 / up 226) | **SANMIK** | as Mikey, when the game lets you change | Mikey ⇄ SanMik (V) |
| the whole screen | the **mash overlay** | the WONK YOUR THANG gauge or the roof's group wonk is up (`mash`) | every finger anywhere is a press (R / Space / click); the buttons hide meanwhile |

The cluster shares its touches (research M3): every control's element reaches `GAP_REACH` (20) px past its drawing; a
touch that lands on one goes to the control whose centre is nearest if it is inside several controls' drawing + 10 px,
else to the control whose drawing is nearest within 20 px (`routeTouch`, layout.ts; `ControlSpec.group`). FIRE,
DODGE, SPECIAL and READY act on touch-down. A control under a thumb stays (and stays live) until the thumb lifts, even if
its mode has moved on; then it hides. Pop-ins (SWAP, READY, HEAL, ACTION, the pocket) animate in and ignore presses for 160 ms.

**The pocket** (thumb-feel round, the user: "the specials, when they do activate, are tiny to press"): the fart, the
fizzy bongo and the SanMik change were 32 px chips under the health bars, top left, out of the right thumb's reach. They
are now full-size round buttons (60 px drawn at 844x390, never under 52; 100 px touch areas), each in its own fixed
place at the cluster's upper left, part of the cluster's shared touch surface, shown only while they can be used (the
calm-screen rule). The juice chip is gone: HEAL is the one button for the juice, up whenever a drink would heal
(`healShown`), red under 40% (`healWanted`).
During a long freeze (more than 400 ms of hit-stop left: the golden transformation's cut-in, a boss's phase break) the
fight buttons hide rather than queue presses for afterwards; the short hit-stops of a fight don't count. SANMIK is
only there when the game would let you swap (not while golden).

**Aiming** (`aim.ts`, research M2): every frame the target is the nearest enemy within 520 world px and on screen,
scored `distance x (1 - bias x cos(angle to the stick))` (bias 0.35 normal, 0.5 strong, 0 off), sticky (a new one must
score under 0.6x the current one, 0.45x strong). Whenever some enemy is inside the gun's own range, only those count
(`fireRange`): a sticky target the gun can't reach never holds the aim, or auto-fire, while another walks up inside it.
With no enemy about, holding FIRE aims at the nearest barrel or crate.
A red ring sits at the target's feet (orange for an object). Strong aim leads moving targets. Aim assist off: FIRE
shoots straight ahead (the last stick direction) and slides don't snap; auto-fire still aims at what it shoots.

**Auto-fire** (research M1, on by default for the first device test): only at an enemy in the gun's own range (each
gun's `range`, modded; the Fart Blaster's), on screen, and never through a live barrel within 115 px of you (it would
blow up in your face). Never at barrels or crates, never a special, never in the mash overlay, the picker, a pause,
a conversation or a scripted moment, never while golden (the golden attack is a lunging melee: auto-fire never moves
you). When the gun runs dry the game's own auto-switch runs (and, the first times, SWAP pulses). In a room whose decree
bans holding the trigger (NO_ATTACK_SPAM, 2.5 s), auto-fire lets go for 160 ms every 2 s, the way a laptop player taps.
FIRE glows red while auto-fire is shooting and flashes with each shot.

**Phone assist** (`phoneAssist`, research S9; numbers in `ASSIST`): pick-ups (coins, ammo, health, Krezz, bottles,
bongos; never quest items) come to you from 140 world px instead of 90 and faster (0.5 px/ms, 2 px/ms inside 60); a
dodge's safe window lasts 60 ms longer (touch and frame delay; about the audit's x1.25 timing lever); enemy bullets
are drawn 1.25x bigger (their hit size is unchanged). It never slows the game.

**First fights** (S10): each icon button (FIRE, DODGE, SWAP, JUMP, HEAL) carries its name inside it, under the icon,
for the first 3 rooms fought on this phone (the `taught` class; never a caption outside the button: see "Stage 2
polish"); READY pulses the first 3 times it pops in, HEAL and SPECIAL the first 2, SWAP the first 2 times a gun runs
dry. Remembered under
`storageKey("krelworld.phone.combatTaught")`. The layer's pressed ring, a flash on the button whose action just happened
(FIRE's shots, a dodge, the special) and the stage 1 buzz (Android) are the feedback.

**The HUD on a phone** (UIScene, `phoneFight()`): see the hooks table. Controls go see-through when the player or the
target is under them (`layer.occluders`, set each frame). The toast column ends left of pause / the fullscreen offer /
the weapon chip in town and in fights (P10), and Kreddle's money counter moves left of pause.

Touch wording added for the fights (UI hints, never a character's line; `COMBAT_WORDING`): the weapon picker's how-to
line, the first dungeon's how-to-play rows (which named the old pad's ATTACK, GUN, E, PJ, WONK, 💨, 🍺, ⚡T buttons and
"Esc pauses..."), and the fights' own toasts (`COMBAT_WORDING_FIRST`: the weapon crate's "press E", "WONK FULL... Press
R.", the IBS "Press G (or the 💨 button)", the Krezz shield's "(R)", the Cronster's hostage "press E", Alistair's
"HEADBUTT him (F / right click)!"). The fights' **narrated** control tips (`COMBAT_NARRATOR_TIPS`; combat.ts adds them to
`NARRATOR_TIPS`, so dialogue.ts applies them to NARRATOR / stage-direction lines only) are listed under "Narrator
control tips" below.

`window.__krelMobile.combat`: `snapshot()` (target, aim, manual / snapped, autoFiring, fireHeld, ready, heal, picker,
mash, mashPresses, taught) and `resetTeaching()`.

## Side rooms, the brawl, finishers, a controller (stage 2 part 2)

**Side-scrolling rooms** (`combat.ts` serves mode `side` too; `side.ts`, `jump.ts`): every side room (Crobley factory,
SanMik Zone / Catford, the Nu Warehouse trip, the Cuddle Tower and the citadel's towers and corridors, the plane, the
colon) drops the old canvas pad on a phone. Layout v2: **JUMP** (84, prime corner, touch area to the corner), **FIRE**
(60) left of it, DODGE / SPECIAL / READY / HEAL / ACTION / the pocket as in top-down rooms, no SWAP button (the weapon
chip swaps). The stick is `"x"`: left / right only, full speed at 35% of the travel. Aim: the way you face plus
auto-aim (no slide-aim); auto-fire is the same setting as top-down rooms (on by default).

Jump feel on a phone (the Player's side branch asks `phoneHooks().sideMove()` first; gravity, take-off speeds and run
speed are the game's):

| | Laptop (unchanged) | Phone (`JUMP_TUNE`) |
|---|---|---|
| Trigger | W / Up / stick up | JUMP on touch-down (a pad's up / stick up still works) |
| Buffer | none | 150 ms (40 ms with phone assist off). A press made while no step runs (a dodge, a hit-stop over 100 ms) counts from the first step after it, as a held key does on a laptop |
| Coyote | 110 ms | 140 ms (110 with phone assist off), judged at the moment of the press, not the frame that reads it |
| Take-off on 120 / 144 Hz | (two full jumps, laptop as it was) | right after a take-off, while rising, "on the ground" (the 60 Hz physics not stepped yet) never gives the jumps back: one first jump and one air jump at any frame rate |
| Height | always the full jump | released early = cut at the later of the release and 100 ms after take-off, to 450 px/s (air jump 390): the quickest tap about 126 px (123 measured in a side room), held 140 ms or more the full 145 (135 measured). Worked out from the height already climbed, so a slow frame doesn't give a taller jump. (Thumb-feel round: it was 80 ms / 300 / 260, a 78 px hop, and the side rooms' standard platforms sit one full jump up, so a quick tap never reached them and a press had to last about 240 ms to) |
| Double jump | release the stick and push up again | a second press of JUMP (buffered like the first) |
| Air control | 140 ms easing | 100 ms (140 with assist off) |
| Drop through | stick down past 0.6 | stick held down past 0.7 (sideways under 0.35) for 150 ms, or stick down past 0.5 and sideways under 0.35 + JUMP on a platform (`DropRule`); the layer's `stickRaw` keeps the stick's y for this even though it drives x only |
| Pits | back at the last safe spot | phone assist: back at least 120 px short of the edge (`pitSafeX`); the stick doesn't walk you toward the pit again until the thumb comes back to the middle or JUMP is pressed (3 s at most); walking away works at once |
| One-way landing | 14 px | 20 px (phone assist), and a jump whose top ends up to 20 px under a platform's top (jumped into from below) is put on it: Arcade only lands a body that enters the top within its 4 px bias in one step, so the collider's own tolerance never got the chance (`ledgePop`, thumb-feel round) |
| Ledge pop / corner correction | none | feet within 8 px below a top, beside it and moving toward it, are put on it (platform tops 4 px wider); a head clipping a solid corner by up to 40% of the body is nudged past it (phone assist) |
| Moving platforms | carried while standing | their speed kept 100 ms after stepping / jumping off |
| Crushers / steam | art-sized | reach x0.88 (phone assist, `ASSIST.hazard`) |
| Camera | lerp 0.12, 80 x 60 dead zone | dead zone 0 x 200, player at 35% / 65% of the width (follow offset -/+144), turning after 0.4 s the other way, eased, the follow offset changing at most 0.45 game px a ms (`CAM_OFFSET_RATE`, `LookAhead.turnMs` 700: a turn used to whip the view up to 135 game px in 60 ms); the view leads 60 px down while falling. The follow is the game's 0.12 a frame made frame-rate independent (`camLerp`) plus the trail it leaves (`camLagPx`), so 35% / 65% holds at 30, 60 and 120 Hz; the laptop's small velocity lead is skipped in phone side rooms |
| Hazards under the buttons | n/a | pits (and their names), moving platforms and crushers are occluders: JUMP / FIRE go see-through over them (JUMP keeps a solid green outline and its icon, so it still reads as JUMP) |

`window.__krelMobile.combat.side.snapshot()`: held, jumps, the waiting press, coyote, the stick's raw direction, the
look-ahead, and the last jumps (`log`: kind, take-off and apex, ms waited in the buffer, ms since the ground).

**The finale brawl** (`brawl.ts`): `SsjBrawl` asks `phoneHooks().brawl(this)` instead of drawing its canvas pad. The
layer shows PUNCH (prime, 84), BLOCK (left, hold), VANISH (upLeft), KICK (up), KI (ready slot, hold), each with its word on
it (no caption under it), and the town's stick; they feed the brawl's own `pad.edges` / `pad.held`, so its hits, freezes and shakes are the game's.
During the finishing rush the buttons hide and a full-screen overlay makes every finger a punch. Wording (UI only,
`BRAWL_WORDING`): the boss card's `HOLD R TO BLAST KI` line, `MASH PUNCH!` → `TAP TAP TAP!`, the corner's
`Esc: skip fight` hides; instead the brawl has its own **II** (`b-pause`): the shell's carry-on card with a **SKIP FIGHT**
button (`shell.pauseCard()`), which does what Esc does on a laptop (`Finale.finish(true)`). The rush's taps (and the
WONK gauge's) are queued and handed over one a frame (`MashQueue`), so two thumbs in one frame are two presses. The brawl's own how-to legend (its first 9 seconds) moves up under the two health bars on a
phone, so the bigger text never runs under PUNCH and BLOCK (`fitLegend`). **The Krezz Arms pub brawl** needs nothing: the Pub is mode none (every touch reaches the
canvas, which swings on any tap) and its line already reads `BRAWL! Tap to swing`.

**The Kreltality prompt** (`Kreltality.ts` `prompt()`, any fight): on a phone its buttons drop the key names and
`phoneHooks().finisher()` adds a big pulsing ☠ KRELTALITY (1.25x the prime slot) under the right thumb, its countdown
as a ring round it, and SPARE at the ACTION slot; the game's own pair and bar hide (two targets for two choices). Both
ignore touches for 400 ms after they appear (`FINISHER_ARM_MS`: a FIRE tap can't pick before the question is read) and
are placed again on every layout (`layer.onLayout`); the prompt's close removes them. Flight KR-069's hero passengers'
"ALL OF THEM" prompt (`HeroPassengers.krelAllPrompt`) uses the same (its 8 s countdown, ALL OF THEM on the button).

**A controller** (`pad.ts`, research S6 / DEFERRED R11): polled each game step; a button going down or an axis moving more than 0.35 from where
it rests (`padWoke` against `padRest`: a trigger resting at -1, a drifting stick or a button resting down never counts)
sets `input: "pad"` in the decision (`setInputSource`), the layer root gets `padin` and every control hides; the next
touchstart anywhere brings them back, and the pad as it is then becomes its rest. A pushed right stick aims (`Controls.aim`'s guarded block; combat.ts's aim hook
steps aside). Note for the phone settings page: `PAD_NOTE` in controlsPicture.ts ("A Bluetooth controller works...").

**The Controls picture** (`controlsPicture.ts`, research S10): `MenuScene.openControls()` asks
`phoneHooks().controlsPicture()` first on a phone, so the pause menu's CONTROLS (and the settings page's) shows a
drawing of the screen with each control where `layer.slots` / the placed chips really are, numbered, with one plain
line each, in tabs WALKING / FIGHTS / SIDE ROOMS / BRAWL (it opens on the one for the fight underneath). CLOSE goes back
to the menu.

**Fullscreen offer in fights** (Android, after leaving fullscreen): shown in combat / side / brawl too (not over a mash
or the picker), at the `fullscreenFight` slot 12 px under pause at any screen height (`layoutSlots` puts it there),
clear of the weapon chip; READY starts below it while it shows (`placeReady`).

**The cutout band** (`layout.ts`): with side insets, a control between 30% and 70% of the height keeps
`islandGap()` = min(60, inset + 13) from a short edge: 60 for the iPhone's Dynamic Island (inset 47), less for an
Android camera cutout (16-40), so SPECIAL is never pushed onto DODGE nor READY onto HEAL there.

## Input rules the layer keeps

- Real CSS px, anchored to the safe area (`max(left, right)` inset both sides; the bottom 21 px never touchable);
  scaled by `clamp(h / 390, 0.85, 1.15)` × S/M/L; never drawn under 52 px; touch box = drawing + 10 px each side.
- Each control is an element whose box is its touch area. `touchstart` is non-passive and calls `preventDefault`
  (no zoom, magnifier, ghost mouse events, and Phaser's window listener ignores the touch). A touch belongs to the
  element it landed on, by id, until it ends; `touchcancel` releases without acting.
- The stick zone is the thumb's 45% of the window, the black gutter included, below the top 20% (HUD) and above the
  bottom strip, in a mode with a `stick`. Nothing inside it takes touches but the zone (research M4): a touch that
  starts there is the stick the moment it moves. The stick appears where the thumb lands and its base stays there for
  that touch (setting `stick: "stays"`, the default since the thumb-feel round; the user: "the joystick ... can slide
  all over the screen, if your thumb does"): pulling past the rim is full speed that way, the knob stops at the rim.
  `"follows"` drags the base along past the rim (the old default), never out of the stick zone (`keepInZone`);
  `"fixed"` keeps it at its resting place. 8 px dead zone, full speed at 60% of the travel (35% for an "x" stick).
- A touch in the zone that ends within 400 ms having moved under 10 px is a tap: on the prompt bubble it is ACTION;
  in a walking scene tap to use takes it next (below); anywhere else it is handed to the game as a tap at that point
  (`injectTap`: down now, up two game frames later). Outside the zone, the bubble has its own tap area (only the part
  outside the zone, below the HUD strip): a quick still tap there is ACTION, a drag nothing. (Outside tap-to-use's
  scenes the thing the prompt is about keeps its stage 1 tap area too.)
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
| `stick` | `"stays"` | yes (layer) | STAYS: the base stays where the thumb landed; FOLLOWS (`"follows"`): dragged along past the rim; FIXED (`"fixed"`): at its resting place. A stored `"floating"` (the old default) reads as `"stays"` and is not kept as a choice |
| `haptics` | true | yes (layer buttons) | `navigator.vibrate` 12 to 25 ms where it exists (Android) |
| `readability` | **true** (stage 2) | yes (see below) | "Bigger text": the font floor and the reading sizes |
| `textSize` | `"normal"` | yes, with readability | `"large"`: every floor x1.25 (labels 13.75, reading 20 CSS px) |
| `batterySaver` | false | yes | 30 frames a second |
| `autoFire` | true | yes (top-down fights) | combat fires by itself at an enemy in range, on screen, with no barrel by your feet in the line |
| `aimAssist` | `"normal"` | yes | `off` (FIRE shoots straight ahead, slides don't snap) / `normal` (stick-biased, sticky, 15° snap) / `strong` (stickier, 25° snap, leads moving targets) |
| `phoneAssist` | true | yes (top-down fights; part 2 adds the jump help) | pick-ups come from further and faster, a dodge's safe window +60 ms, enemy bullets drawn 1.25x |
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
    choice (hidden while choosing). It asks first (research M8): a tap on SKIP shows **KEEP READING** / **SKIP SCENE ▸▸**
    (48 px, 12 px apart) right above the pills; it goes away by itself after 5 s, on Back, or with a second tap on
    SKIP. What was skipped is in the LOG.
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
Every other word of those lines stays. The fights' tips (`COMBAT_NARRATOR_TIPS` in combatWording.ts, added at the
merge of the two stage 2 tracks): Wildern's `CONTROLS: WASD move ...` and the first side room's `SIDE-ON CONTROLS: A / D
to run ...` (data/dungeons.ts), the Citadel's `RUN AND GUN:` and `CLIMB:` legends (content/citadel.ts), Alistair's
`press F to HEADBUTT` (content/bosses.ts) and `a headbutt (F)` (ClubScene), the Jam Queen's `JUMP over her (W / up)`,
the Cronster's `(walk up, press E)` and `Mash ATTACK / DODGE`, and the golden juice's `press T (or ⚡T) ... C (or CUME)`
and `Press T in your next dungeon` (systems/squeeze.ts): each swaps its control words for the phone's buttons (FIRE,
JUMP, DODGE, ACTION, HEADBUTT, GOLD, CUME). tests/mobileCombat.test.ts checks each line still exists as written.

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

## Stage 2 review, fix round 1: smaller things a player sees

- **Archive**: its phone record list carries **◀ LEAVE** (the list sat over the game's own), and Back leaves too.
- **Chapter select / DebugSkip**: a second tap on the picked row keeps it picked; START goes on.
- **Story TV bulletins** (`once`): their NEXT SHOW, which ends the bulletin, reads **SKIP** on a phone (screens.ts).
  The telly plays itself (its beats run on a timer), so it needs no AUTO.
- **Town flyover**: its skip hint becomes a 44 px pill in the top bar (`skipHintPill`, through `WORDING_HOOKS`), out
  of the home-indicator strip; a tap anywhere still skips.
- **Krezz Arms**: taller cards (PubScene's guarded hook), title on top and its line under it (`layoutPubCard`); the
  telly's headline under its show name (`layoutPubTv`).
- **Gun rack**: the how-to line is shorter on a phone (`rack-order`) and wraps left of the coin counter.
- **Town toasts**: pause's place is always kept in the Hub (`toastRight`), even for a toast made while it was hidden.
- **Fights**: READY's IBS caption is IBS and the 💨 chip steps aside while READY offers IBS; the weapon chip shows the
  gun's whole name on two lines; the tutorial's SWAP row says it appears with a second gun; WONK YOUR THANG's title
  sits clear of the HUD's KREZZ / WONK lines; the Cronster's hostage tags and the Citadel's exchange sign lose their
  key (`FIGHT_UI_LINES`, checked when a Dungeon text is made, never every setText).
- **Home-indicator strip**: a caption that would sit in it goes over its button; the conversation's ▼ is lifted out.
- **Controls picture**: FIRE's line follows the auto-fire setting; "▼ more" while the legend scrolls; words in the
  picture only where they fit at 11 px; ACTION's line promises only what works.
- **Phone settings**: Vibration only where `navigator.vibrate` exists (never on an iPhone).

## Stage 2 polish: a calm fight screen

The user, on the live build: "in dungeons on right hand side of the screen you can see a bunch of bubbles for every
potential special even when they're not active". The rule now (`combatLogic.ts`, "a calm fight screen"):

- **Always** (what a thumb needs): the stick (it appears where the thumb lands; its idle drawing fades once you've
  walked), FIRE (or JUMP and FIRE in a side room), DODGE, the weapon chip (gun and ammo; tap = next gun), pause.
- **Only while it can be used right now**, popping in (never drawn dim "for later"): SWAP (a second weapon with ammo),
  SPECIAL (enough Krezz for it, no decree against it: `specialWanted`, with the game's own discounts in `specialCost`),
  READY (a meter ability is ready), HEAL (a drink would heal: `healShown`; red under 40%), ACTION (a prompt), and the
  pocket (thumb-feel round): 🍺 (a bongo to drink), 💨 (level 1 to 3; IBS is READY's), SANMIK (as Mikey, when the game
  lets you change), full-size buttons at the cluster's upper left.
- **Names, not captions** (N1): the first-fights words live inside the icon buttons; the brawl's buttons carry their
  word; no fight control has a caption under it, so nothing can print on a neighbour, the HUD or the home-indicator
  strip at any size, side or setting.

Measured by the smoke's `polish` section (controls on screen, the stick included, both at 844x390 with the iPhone
insets and at 740x360): a fresh room with a new game's kit 8 → 7, the same room with nothing left to use 7 → 5,
mid-game with everything charged 12 → 11, a boss 9 → 8, a side room's start 9 → 8, the finale brawl 7 → 7 (its
captions gone).

Also: the **room name** up top (`roomName.ts`, N2) is fitted between the top-left block and the weapon chip each frame
(`game.events` "poststep"): where it doesn't fit it shows the room's own name (after the last " · "), ellipsised if
needed, or nothing; out of a fight it goes back as the game made it. The **Krezz Arms Leave card** is drawn 30 px
higher on a phone (PubScene's guarded hook, N4), clear of the bottom 21 px.

## Stage 3: the phone platform (sound, memory, frame rate, saves, pause routes)

**Memory (`art.ts`).** The laptop decodes every picture at boot and keeps them (about 920 MB). On a phone the pictures
`artLogic.ts` `PARKED_ART` names (the telly's faces, anchors and cast; the bosses' animation / death / down sheets; the
Kreltality and victory sheets; the finisher cinemas and versus cards; every `*_still_*`, `*_cut_*`, `*_eyes_*`) are
parked the moment the loader adds them: the texture keeps its key, size and frames (so `textures.exists()`, frame
numbers and `getSourceImage().width` are exactly as on a laptop; a parked source is a 1 x 1 canvas that reports the real
size, so a pixel read is blank, never an error) and the GPU holds a 1 x 1 blank. Anything that draws it (an Image or
Sprite rendering it), asks for it (`textures.get` / `getFrame`, after the boot) or starts an animation on it fetches it
back (from the browser's cache, decoded off the main thread: 100-800 ms in emulation; it pops in). A 5 s sweep parks
what nothing has used for 30 s and no game object holds. A lost WebGL context fetches the live ones again. No game file
changed for it. Measured on the iPhone profile: boot 917 → 309 MB; peak over home, town, a TV show, the Hoard and the
concept boss 953 → 352 MB (`mobile-smoke --only platform` fails above 500). Decoded sound stays about 120 MB.

**Sound (`audio.ts`).** iOS ignores an `<audio>` element's volume and lets an element play only if its first `play()`
came from a tap; the game makes a new element for every song and every slowed / sped-up voice line. On a phone
`window.Audio` hands out one of five pooled elements (three songs, two voices) that the first `touchend` / `click`
started silently; each is routed through its own gain node, and the element's `volume` property sets that gain (the
Music / Voice sliders, fades and the dialogue duck all work). The game's listeners on a pooled element are removed when it
is handed out again. A self-test listens to the first song: five seconds of digital silence through the route switches
later songs to plain elements (the slider is then on / off through `muted`). The audio session is "playback" (sound with
the ringer switch off) unless "Play over my music" is on ("ambient"). After the page is shown again the context is
checked (it must run and its clock must move; otherwise suspend + resume once more; the next tap tries again). A song
playing that is neither the current one nor fading out is stopped (no double music); a song the pause menu holds stays
held. `?mobilediag` shows the route, the session, what is playing and the last resume and its reason.

**Frame rate (`perf.ts`).** Top-level Images and Sprites that scroll with the world and sit wholly outside the camera's
view (plus 96 px) are skipped for that camera (nothing else about them changes). At most 40 blood pools show in a fight
(older ones hidden, not removed). A ring at the player's feet in the concept boss's Krelford, a dark room, or a screen of
220+ objects. The concept boss's camera stays at zoom 1 on a phone (guarded hook in `KrelfordFinale.ts`, below).
Emulation cannot measure a phone's frame rate here: 93% of a frame is the software GPU; the JS per frame is 19-22 ms at
4x CPU throttling in the concept boss either way. A real-device reading (`?mobilediag`) is in the device checklist.

**Saves and caching (`storage.ts`).** The game autosaves all the time and the shell saves on hide / pagehide; the phone
adds a save on Chrome's `freeze`, and asks `navigator.storage.persist()` once per launch, silently (Safari and Chrome
answer without a prompt; Firefox would show one, so it is never asked). Nothing is shown to the player. No service worker:
the HTTP cache already serves a repeat visit (measured with GitHub Pages' headers and a disk-backed profile: first visit
103 MB, reload 0 MB from the network, a parked picture fetched back from the cache), and a worker that served stale art or
code after a deploy would be hard to get off friends' phones. In an app's own browser (Instagram, Messenger...) the boot's
download is held (`maxParallelDownloads` 0) behind the "open it in Safari / Chrome first" card until PLAY HERE ANYWAY.

**Pause routes.** `PauseRoute` is `"edge" | "menu" | "card"`. The minigames (`MINIGAME_PAUSE`: Minigame, Whack, Drive,
BeepBeep) have the II and the game's pause menu (`"menu"`: the menu holds the song and pauses the scene); the finale
between brawl rounds is tap mode with the II and the shell's PAUSED card (`"card"`; the song holds under it). Coming
back to the phone opens that pause (`wakeCare` → "pause") instead of the carry-on card. A wave 2 scene gets one with a
rule (`pause: "menu" | "card", pauseButton: true`); `setCardPause()` (observe.ts) is how the card route reaches the shell.

Hook added in stage 3 (guarded; the laptop fingerprint is unchanged):

| Where | What | Why |
|---|---|---|
| `src/game/scenes/finale/KrelfordFinale.ts` | `setZoom(isMobile() ? 1 : 0.8)` and `zoomTo(isMobile() ? 1 : 0.8, 10)` (and the flag import) | The audit: zoomed out below 1, everything on a phone's screen is too small |

On a phone `window.__krelMobile` also has `art` (`report()`, `resident()`, `isParked(key)`, `sweep(ms)`), `audio`
(`diag()`, `musicGain()`), `perf` (`lastCulled`, `lastDrawn`, `poolsHidden`, `enabled`) and `storage` (`state`, `held()`).

## Thumb-feel round (the user's own iPhone test)

The user, on the live build: "jumping feels a little awkward", "The specials, when they do activate, are tiny to
press", "Is there a pause button?", "The joystick ... can slide all over the screen, if your thumb does".

- **Stick**: its base stays where the thumb landed (`stick: "stays"`, above); FOLLOWS / FIXED in Settings.
- **Specials**: the pocket (above): 💨, 🍺 and SANMIK full size on the right; HEAL is the juice's one button.
- **Jumping**: a quick tap reaches the standard platforms (126 px, was a 78 px hop), a jump ending up to 20 px under a
  platform's top is put on it, turning round no longer whips the camera, and the idle stick hint moves off the player
  at a side room's start (it sat on him).
- **Pause**: the layer's II (52 px drawn, 72 x 68 to touch, top right, clear of the island) shows in every phone mode
  that has a pause on a laptop: walking (Home, Hub, Club, Kreddle and its raid / rout, the Venue), top-down rooms, boss
  rooms, side rooms (also while the WONK mash overlay is up), and the finale brawl (its own II, the carry-on card with
  SKIP FIGHT). Not while a conversation, a scripted moment or the weapon picker is up (none pauses on a laptop either),
  not on menus (they are the pause), and not in the overlay minigames: none of them pauses on a laptop (Whack and
  RuneScape's Esc leaves); stage 3 looks at those.

## Testing

```sh
npx vitest run tests/mobile tests/desktopNotPhone.test.ts   # flag, modes, layout, settings, readability, wording, home screen + diag, combat, jump; dialogue (pills, AUTO, choices, Back, page size, narrator tips, settings page, idle stick), lists (paging, reorder, boxes of ammo, character select, the wording sweep); the not-a-phone devices

npx vite --port 5202 --strictPort &                       # normal build
VITE_KREL_ALT=1 npx vite --port 5212 --strictPort &       # ALT build
node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,dialogue,settings2,lists,wording,guide,optout,town,dungeon,combat,side,brawl,together,review1,polish,platform,android,tapuse,desktop]
node scripts/mobile-smoke.cjs --url http://localhost:5212/
# (tapuse: at Home the telly, the book and the gun rack from the far side of the room, the stick stopping a walk, a
#  second tap re-targeting, the floor, in reach = at once; a person and the Krezz Arms in the town; a Kreddle local;
#  the Club's bar)
# (polish: the fight screen measured at four phone sizes: no caption or word over anything, only usable controls shown,
#  JUMP plain over the first pit, the room name clear of the HUD, the Leave card above the home-indicator strip)
# (review1: FIRE held through a death leaves no held attack; a pad resting off-centre never takes over; the archive's
#  LEAVE; the finale brawl's II and SKIP FIGHT; a pit with the stick held toward it)
# tests/mobileWordingScan.test.ts: no touch-wording rule may match any character line in the game
# (platform: the sound route and the Music setting, resume after a hidden page, one song at a time, the texture ceiling
#  over six scenes, pause in a minigame and the finale, the in-app download hold; tests/mobilePlatform.test.ts the rules)
# (together: the two stage 2 tracks at once: bigger text in a fight, a conversation in a fight (pills, no fight
#  buttons), PHONE SETTINGS live in a fight, pause -> CONTROLS on FIGHTS, the Krezz Arms brawl by tap)

# the laptop must not change (both must end with DESKTOP FINGERPRINT: OK)
A="--url http://localhost:5202/ --alt-url http://localhost:5212/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt
npx vitest run tests/desktopInvariants.test.ts
# and the devices next to a phone (after any change to the detection or a guarded scene hook)
for p in touchlaptop ipad fire7; do node scripts/desktop-fingerprint.cjs --url http://localhost:5202/ --no-alt --profile $p --only front,newgame --check; done
node scripts/desktop-fingerprint.cjs --url http://localhost:5202/ --no-alt --profile androidtab --only front,newgame,hub --check
```

On a phone (or devtools device emulation) `window.__krelMobile` has `tapUse` (stage 3), `combat` (part 1; `combat.side` for the jump), `brawl`
(`snapshot()`), `pad` (the controller handover), `picture` (the Controls picture: `show(tab)`, `snapshot()`), `dialogue`,
`settingsPage`, `lists` (`open()`), `snapshot()`, `shellState()`, `view()`, `layer`,
`shell`, `setInsets({top,right,bottom,left})` (emulators report no safe-area insets; `{0,47,21,47}` is an iPhone 14
home-screen app; CDP `Emulation.setSafeAreaInsetsOverride` plus a resize drives the real `env()` path), `settings.get() /
set(patch) / list()`, `readability`, `guide`, `diag`, `plumbing()` and `fakeInstallPrompt(outcome)` (dispatches a
`beforeinstallprompt` the way Chrome would), and `api` (`registerModeController`, `unregisterModeController`,
`addSceneRule`, `SCENE_RULES`, `verbFromPrompt`: the game's own module instances, for tests). It exists on phones only.

`?mobile=1` in a desktop browser needs device emulation (touch points); without it the address is ignored. With it the
layout shows, but the layer listens to touch events only (mouse does not drive the stick) and the dungeon then has no
touch pad.

# Phone mode (`src/game/mobile/`)

KRELWORLD on a phone held sideways. Everything phone-only lives in this folder. On a laptop (touchscreen or not), a
tablet, or in node, none of it runs: `installMobile()` returns at once, so the laptop game is byte-for-byte what it was
(proved by `scripts/desktop-fingerprint.cjs --check` and `tests/desktopInvariants.test.ts`).

## How it fits together

```
main.ts ── installMobile(game) ──► isMobile()? no → return (nothing at all happens)
                                   yes ↓
            TOUCH.enabled = true   (the game's own touch paths: wording, auto-aim, the raid's FIRE button)
            Shell  (shell.ts)      html.mobile + CSS, single centring, rotate screen, sleep/wake, fullscreen, back guard
            TouchLayer (touchLayer.ts)  HTML controls inside #game, above the canvas
            game POST_STEP ──► shell.frame(); layer.frame()
                                   layer.frame():  readView(game)  ──►  resolveMode(view)  ──►  layer.apply(decision)
                                                   (observe.ts)         (modes.ts, pure)
```

| File | What it does |
|---|---|
| `flag.ts` | `isMobile()`, decided once at load. Pure `detectPhone()` / `resolveMobile()` for tests. `setMobileForTests()` |
| `platform.ts` | iPhone / Android / home-screen app / in-app browser (pure `platformFrom()`) |
| `settings.ts` | `PhoneSettings` (left-handed, S/M/L, opacity) with defaults; `usePhoneSettingsStore()` for part 2 |
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
  back. iPhone keeps the title screen's Add to Home Screen hint.
- Back gesture: one guard history entry after the Enter tap; a back swipe pauses (a second one, while paused, leaves).

## Testing

```sh
npx vitest run tests/mobileFlag.test.ts tests/mobileModes.test.ts tests/mobileLayout.test.ts

npx vite --port 5202 --strictPort &                       # normal build
VITE_KREL_ALT=1 npx vite --port 5212 --strictPort &       # ALT build
node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,optout,desktop]
node scripts/mobile-smoke.cjs --url http://localhost:5212/

# the laptop must not change (both must end with DESKTOP FINGERPRINT: OK)
A="--url http://localhost:5202/ --alt-url http://localhost:5212/ --check"
node scripts/desktop-fingerprint.cjs $A --only shell,front,newgame,hub,meeting,dungeon
node scripts/desktop-fingerprint.cjs $A --only boss,side,places,minigames,finale,alt
npx vitest run tests/desktopInvariants.test.ts
```

On a phone (or devtools device emulation) `window.__krelMobile` has `snapshot()`, `view()`, `layer`, `shell` and
`setInsets({top,right,bottom,left})` (emulators report no safe-area insets; `{0,47,21,47}` is an iPhone 14
home-screen app). It exists on phones only.

`?mobile=1` in a desktop browser without device emulation shows the layout, but the layer listens to touch events
only (mouse does not drive the stick) and the dungeon then has no touch pad: use devtools device emulation.

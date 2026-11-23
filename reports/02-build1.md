# 02 · Phone foundation, part 1 (stage 1)

**Commits** on branch `mobile` (worktree `scratchpad/mobile-wt`), on top of the safety net `9ccb2d13`:

| Commit | For the player |
|---|---|
| `dad88630` | The game knows it is on a phone, fits the screen, and you can walk everywhere by touch |
| `9ab8f5c9` | The rotate screen covers the first load; controls keep their corner on short screens; phone README |

Worktree clean, nothing pushed. Dev servers stopped.

## Checks (all on the final code)

| Check | Result |
|---|---|
| Laptop fingerprint, half 1 (`shell,front,newgame,hub,meeting,dungeon`) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** |
| Laptop fingerprint, half 2 (`boss,side,places,minigames,finale,alt`) | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** |
| `npx vitest run tests/desktopInvariants.test.ts` (unedited) | 19 of 19 |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 290 tests, 34 files, all pass (49 new: flag, modes, layout, settings) |
| `node scripts/mobile-smoke.cjs` normal build | **47 of 47, MOBILE SMOKE: OK** (91 s) |
| `node scripts/mobile-smoke.cjs` ALT build | **47 of 47, MOBILE SMOKE: OK** |
| `git diff 9ccb2d13 -- index.html tests/fingerprints tests/desktopInvariants.test.ts` | empty |

## What exists now (all phones only)

1. **The flag** (`flag.ts`): `isMobile()` = coarse pointer AND no hover AND touch points > 0 AND short side of `screen`
   ≤ 600 CSS px, decided once at load. `?mobile=1` on, `?mobile=0` off, `?mobile=auto` forget; remembered under
   `storageKey("krelworld.mobile")` and written only when the address asks. False in node. `setMobileForTests()`.
2. **The shell** (`shell.ts`, `css.ts`, `rotate.ts`): `html.mobile` + CSS (touch-action none, no selection, no callout,
   no tap flash, no overscroll, `100dvh`); the double centring fixed **on phones only** (iPhone 14: gutters 75 / 75.7,
   were 113 / 38; Android 740x360: 50 / 50); the rotate screen (DOM, up before the first frame, so it covers the
   load; iPhone and Android each get their own "still upright?" tip; an empty `extra` slot for the Add to Home Screen
   guide); while it is up the loop sleeps and the music and sound context hold, except during the first load, which
   carries on behind it; hidden / pagehide: release, sleep, hold sound, `G.save()`, then wake and resume (context
   suspended then resumed 150 ms later for iPhone); debounced `visualViewport` / resize / orientation refresh;
   Android: the Enter-gate touchend fullscreens `#game` and locks `"landscape"` (verified), re-offer button after
   leaving fullscreen (verified); iPhone keeps the title's existing Add to Home Screen hint; back gesture → pause
   (one guard history entry; a second back while paused leaves).
3. **The touch layer** (`touchLayer.ts`): HTML controls inside `#game` (so they stay visible in fullscreen),
   `pointer-events:none` except live controls, real CSS px, safe-area anchored (probe element reading
   `env(safe-area-inset-*)`), nothing touchable in the bottom 21 px, ≥ 52 px drawn, touch box = drawing + 10 px,
   outline at the opacity setting (30%) and 70% pressed with a ring, press owned by touch id, `touchcancel` handled,
   everything released on mode change / hidden / rotate / blur, transforms only per frame, 160 ms arming for
   controls that just appeared.
   - **walk**: floating stick anywhere in the left 45% of the window below the HUD strip, **gutter included**; faint
     idle stick with a "MOVE" hint until the first walk; follow past the rim; 8 px radial dead zone; full speed at 60%.
     **ACTION** in the prime corner (84 px, research layout v2), only while a prompt shows, with the verb from the
     prompt (TALK, ENTER, READ, LOOK, INSPECT, HIT, CROSS... USE for anything else); pops in. **Tapping the prompt
     bubble** also does it. **Pause**. **SANMIK** when playing as Mikey (not in the SanMikverse, not in the raid).
   - **none** / **tap**: nothing touchable (pause where the table allows; none does in stage 1).
   - **combat / side / brawl**: registered as "legacy pad": the existing canvas pad runs them exactly as before and
     the layer has zero touchable elements (verified in Wildern: old stick moved the player 262 px, its II paused).
   - A quick tap in the stick zone (under 400 ms, under 10 px) is handed to Phaser as a real touch at that point
     (verified: an interactive zone at game (150, 330) got down and up at exactly (150, 330)); drags and resting
     thumbs are not taps.
   - `synth.unlock()` on the first touch on the layer if there is no context; every touchend resumes a suspended one.
4. **Blockers**: **B1 fixed** (Home, Hub, Club, Kreddle, Venue and the Kreddle raid all walk by the visible stick,
   ACTION and pause; the old invisible pad is not made in town on phones). **B2 fixed** (portrait = rotate screen,
   loop asleep, sound held; landscape resumes). B3 (Kreddle crash after the flyover) is a laptop bug too: untouched.
5. **Pause from every scene where pausing is allowed**: Home and Hub, and the raid / rout, through their own Esc path
   (`TOUCH.edges "pause"`, what the old II sent); Club, Kreddle and the Venue open the real pause menu over the scene
   (`launch Menu {mode:"pause", caller}` + `pause`, the way Home does it), RESUME returns (verified in the Venue).
   Dungeon: the old pad's II. The back gesture uses the same routes.
6. **Tests and tools**: `tests/mobileFlag.test.ts` (pure detection, overrides, remembered choice, startup with stubbed
   `window` / `matchMedia` / `navigator` / `screen` / `location` / `localStorage`, node default false, throwing
   storage, platform detection), `tests/mobileModes.test.ts` (the table, overlays, busy, raid, Mikey, legacy pad, rule
   injection, verb extraction), `tests/mobileLayout.test.ts` (scale, safe area, flipped phone, hit areas, 52 px
   minimum, inside the safe area, Dynamic Island band, mirror, S/M/L, stick zone and maths, ghost, settings store).
   `scripts/mobile-smoke.cjs` (phone / upright / optout / desktop sections, real CDP touch events, `--shots`).
7. `src/game/mobile/README.md`: architecture, hook rules, the mode table and API, how stage 2 adds a mode, testing.

## API (for part 2 and later)

```ts
import { isMobile, installMobile, mobileLayer, mobileShell,
         addSceneRule, resolveMode, registerModeController,
         phoneSettings, updatePhoneSettings, onPhoneSettingsChange, usePhoneSettingsStore } from "src/game/mobile";
type LayerMode = "none" | "walk" | "combat" | "side" | "brawl" | "tap";
interface ModeDecision { mode; scene; pause: "edge" | "menu" | null; pauseButton; action: string | null; sanmik; legacyPad }
interface SceneRule { name; match(key): boolean; decide(scene: SceneState, view: GameView): Partial<ModeDecision> | null }
interface ModeController { id; enter?(ctx); frame?(ctx); release?(ctx); leave?(ctx) }   // ctx = { layer, game, decision }
interface PhoneSettings { leftHanded: boolean; buttonSize: "S" | "M" | "L"; opacity: number }  // defaults false / M / 0.3
layer.slots   // prime, left, upLeft, up, ready, heal, combatAction, walkExtra, pause, fullscreen → { cx, cy, size, hit }
layer.injectTap(clientX, clientY); layer.pause(); layer.releaseAll(); layer.setInsetsOverride(insets)
observe.ts: readView(game), promptRect(game, d), pressInteract(), pressPause(game, d), pressSanmik(), ADAPTERS
window.__krelMobile (phones only): snapshot(), view(), layer, shell, setInsets()
```

## Every hook outside `src/game/mobile`

| File | Lines | Why |
|---|---|---|
| `src/main.ts` | `import { installMobile } from "./game/mobile";` and `installMobile(game);` (with a comment) right after `new Phaser.Game(...)` | The single entry point, as early as possible so the rotate screen covers the load. Returns at once on a laptop. Scene list and config untouched (invariants test passes) |
| `src/game/scenes/UIScene.ts` | `import { isMobile } from "../mobile/flag";` and in `setupTouch()`: `if (isMobile() && this.mode !== "dungeon") { this.touch?.destroy(); this.touch = null; return; }` | Observation cannot remove the old pad cleanly: it is created inside the UI scene on every `create` / `mode` event, and its zone would also catch the taps the layer hands over. In hub mode nothing in the HUD reads `this.touch` (checked), so no HUD change on phones |

Nothing else outside the folder changed (besides the new tests and `scripts/mobile-smoke.cjs`).

## Where I followed the research rather than the brief or audit (and why)

- **Hit slop 10 px on every side** (research M3 defines it this way; the brief's "8 px larger" is ambiguous).
- **ACTION in the prime corner, 84 px** (research layout v2, walk mode) instead of the audit's 52 px at (690, 236):
  a big obvious button under the right thumb, and the only one there in town.
- **Pause drawn at 52 px** (the brief's minimum) at the research's top-right position; the research table had 44.
- **Left-handed mirrors the thumb controls but not pause / fullscreen**: mirrored pause would sit on the HUD's face
  and name at the top left.
- **Dynamic Island band only where the screen reports side insets**, and a 6 px graze allowed: otherwise on
  Safari-with-bars (750x340, no notch) ACTION was pushed 52 px inward for a 1 px overlap.
- **Club, Kreddle, Venue: pause = the pause menu** (on a laptop Esc walks you out of these; each has an exit to walk
  to, so the phone button is a true pause).
- **Loading continues behind the rotate screen** (the brief says the loop sleeps while it is up; it does, from the
  moment the first load finishes).
- Research M4 back gesture → pause and M9 touchend audio resume: added (small, phone-only, in the shell).
- Not yet (no right-hand cluster in stage 1): "a touch in a gap goes to the nearest control within 20 px", haptics,
  Floating / Fixed stick setting (follow is on). iPhone edge-swipe blocking exists only where the stick zone is live.

## Text that mentions keys (left exactly as it is; rule 3)

Dialogue / narration (do not touch): the welcome at home "TIP: WASD / arrows (or the stick) to walk. E to use
things..." and "...Walk up to it and press E."; Mikey's tip "Press V (or the SANMIK button)"; Wildern's arrival
"CONTROLS: WASD move · Mouse aim · Left click attack..."; the Kreddle raid's "HOLD the attack button (mouse / J / the
fire button) to spray...". UI labels for the stage 2 wording helper: every prompt bubble ("E: Talk to...",
"E / ATTACK: hit..."), the town toasts ("WASD to walk. E to talk/interact... Esc for menu", "...pause menu (Esc)"),
the SanMik toasts ("Press V any time", "V to change back"), the dialogue footer "E / Space · Tab skip".

## Left for part 2 and later stages

- Part 2: the settings store and Phone page (`usePhoneSettingsStore`, left-handed, S/M/L, opacity, stick type,
  haptics); the Add to Home Screen guide (use `mobileShell().rotate.extra` and a title / pause entry).
- Stage 2: combat / side / brawl controllers (`registerModeController`) and a non-legacy Dungeon rule; drop the old
  pad in the dungeon (same guarded line); guarded hooks in `Controls.aim/aimPoint/attackHeld` (they test
  `activePointer.wasTouch`); dialogue SKIP / LOG / pause pills (no pause in conversations, meetings, cutscenes yet);
  touch wording; menus at 44 px; bigger text.
- Stage 3: minigames (tap mode has no pause yet), audio pool / gain, memory, performance; tapping the object itself
  (only the prompt bubble now); B3.

## Unsure / to check on a real phone

- `env(safe-area-inset-*)` via the probe: emulators report 0; checked with `setInsets({0,47,21,47})` only.
- iPhone: does the touchend resume reliably restart sound after a lock; music element pause / resume on hide.
- Android: fullscreen + lock verified in headless Chromium only; back gesture inside fullscreen exits fullscreen first.
- `TOUCH.enabled` is now true from page load on phones (before: from the first UI scene). This only turns on the
  game's existing touch wording / paths earlier (e.g. the Settings "Touch aim assist" row on the title); judged better.
- The faint idle stick sits over the room's bottom-left (e.g. the telly at home); fine in the emulator, judge in hand.
- Unknown verbs show USE (Jukebox, slot machines, the Exchange); a small noun→verb map could say PLAY.
- Pre-existing, not mine: `TouchControls` calls `addPointer(3)` on every creation (pointers pile up to Phaser's cap).

## Judged against "mega intuitive and fun"

Walking is now what a first-time player expects: put a thumb down on the left, the stick is there; a big button on
the right appears only when there is something to do and says what ("TALK"); pause is always top right; upright
phone gets a clear "turn it sideways". Not yet intuitive: the prompt bubbles still say "E:", conversations need a tap
per line with no skip, menus are tiny, and fights still use the old twelve-button pad (stage 2).

## Screenshots

`scratchpad/mobile/shots/build1/` (iPhone 14 landscape unless named): `03-home-walk`, `04-home-drag`, `05-home-action`,
`07-pause-menu`, `08-portrait`, `09-hub`, `10-club`, `10-kreddle`, `10-venue`, `11-dungeon-oldpad`, `13-android-title-offer`,
`14-hub-mikey-insets` / `15-hub-talk-prompt` (with real iPhone insets), `16-hub-dialogue`, `17-hub-lefthanded-L`,
`18-hub-750x340`, `19-hub-740x360` (18 was taken before the band fix), `20/21-kreddle-raid`; `smoke/` from the last run.
Exploration scripts: `scratchpad/mobile/work/build1/`.

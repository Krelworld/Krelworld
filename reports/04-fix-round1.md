# 04 · Fix round 1 (stage 1, after review)

Branch `mobile` (worktree `scratchpad/mobile-wt`), on top of `4cedf4ef`. Two commits:
`70b890ee` (the phone fixes, tests, smoke, README) and `e8cf3f4f` (the fingerprint `--profile` option and its
baselines). Nothing pushed, no PR. Dev servers 5206 / 5216 (and a base-source server on 5226 for recording) stopped;
the production build made for the size check was deleted straight after.

All 36 findings (L1-L7, P1-P16, R1-R13) were checked before anything was changed: each was reproduced from the
reviewer's script, by reading the code, or both. None was rejected: all 36 were real. 30 are fixed (7 of them partly,
with the rest deferred). 6 are deferred whole to the stage they belong to (L5, P9, P10, P12, P16, R11), and so are the
remaining parts of the partial fixes. Every `affectsLaptop: true` finding (L1 to L4) is fixed. Deferred items are in
`reports/DEFERRED.md`.

## Checks on the final code

| Check | Result |
|---|---|
| Laptop fingerprint, half 1 (`shell,front,newgame,hub,meeting,dungeon`) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** |
| Laptop fingerprint, half 2 (`boss,side,places,minigames,finale,alt`) | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** |
| `npx vitest run tests/desktopInvariants.test.ts` (unedited) | 19 of 19 |
| New: `--profile` fingerprints against baselines recorded on the base source `9ccb2d13` | touchlaptop 16/16, ipad 16/16, fire7 16/16, androidtab 29/29 (front, newgame, and for the Android tablet also hub), all OK |
| Reviewer's Fire 7 / touchscreen laptop / iPad recordings (their `profile-hook.cjs`, their base baselines) | fire7 front 7/7, touchlaptop front 7/7, ipad front+newgame 16/16: OK (Fire 7 used to differ from the Enter gate on) |
| Reviewer's detection matrix (`review-laptop/detect-matrix.cjs`) | 23 of 23 rows ok (was 6 WRONG); `?mobile=1/desktop/laptop/(empty)` on a laptop: not phone, nothing sticky |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 395 tests, 39 files, all pass (42 new) |
| `node scripts/mobile-smoke.cjs --url <normal>` | **175 of 175, MOBILE SMOKE: OK** (338 s) |
| `node scripts/mobile-smoke.cjs --url <ALT>` | **175 of 175, MOBILE SMOKE: OK** (329 s) |
| Production build (by hand) | main chunk 5,460,600 bytes (base 5,456,424: +4.2 KB; before this round +71.5 KB), gzip 1,703,706 (+2.1 KB; was +24 KB). Phone chunk 84,686 bytes (28.9 KB gzip), fetched only on a phone. A phone (upright) gets the rotate screen 1.0 s after the request starts and the layer installs; a laptop requests only the main chunk. No page errors either way |

## Laptop findings (all fixed)

**L1 (blocker): 600 px tablets got phone mode. Fixed.** Confirmed with the reviewer's matrix and Fire 7 fingerprint.
The detection (`flag.ts detectPhone`) is now, cheapest first and stopping at the first "no":
touch points > 0; short side **under** 600 (Android's own line; Fire 7, Nexus 7 and the 8-inch 1280x800 tablets report
exactly 600); the user agent is not Windows or ChromeOS (8-inch Windows tablets at 150%, the GPD Pocket at 200% and the
Deck on Windows report 533 to 600); not an Android tablet (Android without "Mobi"); coarse pointer; no hover. Phones in
"desktop site" mode (Linux or Mac user agent) still count, through size, touch and pointer.
The constant is renamed `TABLET_MIN_SHORT_SIDE`. The `mobileFlag.test.ts` case that pinned 600 as a phone now expects a
tablet, and the file gains cases for Fire 7, Nexus 7, 600x1004, a Fold unfolded, iPad mini, Windows and ChromeOS. The
evidence is above: the detection matrix, the Fire 7 profile identical to the base, and an Android tablet profile with
the old pad in home and town identical to the base.

**L2 (major): `?mobile=1` was remembered for good. Fixed.** `?mobile=1` (also `on`, `true`, `yes`, `phone`) is now for
that page load only and is never stored. It also needs touch points: on a computer without a touch screen it is
ignored, so a shared test link cannot put a laptop into phone mode. Devtools device emulation has touch points, so
development still works.
`?mobile=0` (also `off`, `false`, `no`, `desktop`, `laptop`, `pc`, `computer`) is the phone's escape hatch and the only
thing stored. `?mobile=1` clears it, and so does `?mobile=auto` (or `reset`). An empty or unknown value (`?mobile`,
`?mobile=banana`) is ignored. A stored "1" left by the old build is ignored.
`rememberPhoneMode("off" | "auto")` is ready for stage 2's "Phone controls: off" row.
New smoke checks run on a laptop with "1" in storage, and on a laptop opening `?mobile=1&mobilediag`. Both get the plain
laptop game: no class, no layer, no read-out, no global. `tests/desktopNotPhone.test.ts` (new) checks the same for 18
devices, with storage "1" and with every `?mobile=` value.

**L3 (minor): every laptop read storage and ran 8 media queries. Fixed.** The decision is now made on the first
`isMobile()` call (still once), and the explanation is built only when the diagnostics ask for it. On a computer
without a touch screen it reads two numbers (touch points, screen size). A touchscreen laptop or a tablet stops at its
size or its user agent. Neither reads storage or asks a media query. Storage is read only when there is a `?mobile=`
choice, or when the device tests say phone.
Checks:
- unit tests count the reads in node;
- the smoke test's laptop context spies on `Storage.getItem` and `matchMedia` from the first script. Calls whose stack
  is in `src/game/mobile/` come to 0 and 0;
- the `index.ts` header and the README now say so.

**L4 (minor): all phone code shipped to every laptop (+71 KB). Fixed.** A new `boot.ts` is the only phone code in the
static graph, along with `flag.ts`. It holds `installMobile()`, which does `import("./index")` on a phone only (3 tries,
then falls back to today's game rather than a phone with no controls). It also holds the title / pause helpers, which
answer "no" until the phone chunk registers itself.
Changes outside the folder are import paths only: `main.ts`, `TitleScene` and `MenuScene` import from `mobile/boot`.
The phone chunk copes with arriving after the game has booted: `whenRunning()`, scanning scenes already built for
wording, and putting the toast listener first in line.
Measured in production (table above). In dev, the smoke test checks that a laptop fetches only `flag.ts` and `boot.ts`
from the folder, before and after starting a game.

## Phone and robustness findings

| Id | Verdict | What changed (phones only) | Test |
|---|---|---|---|
| L5 | real, **deferred** (stage 4) | Foldables decide at load (documented in README); a reload prompt on a size change is for device QA | – |
| L6 | real, **fixed** | `desktop-fingerprint.cjs --profile touchlaptop|ipad|androidtab|fire7`: the same chains with that device's screen, touch points, user agent and pointer / hover answers. Baselines in `tests/fingerprints/profiles/`, recorded from the base source (`git archive 9ccb2d13`, served on its own port); re-checked on the base for determinism (29/29). The old pad is pinned (the "II" pad button is in the tablet home and hub states). `tests/desktopNotPhone.test.ts` holds the pure "not a phone" cases outside the phone team's files (the invariants test itself must stay unedited, so the vacuous node check stays; the new file is what can fail) | profiles all OK |
| L7 | real, **mostly fixed** | Stored / URL state on a laptop, storage reads, media queries and fetched modules are now checked by `mobile-smoke --only desktop`; the production bundle was checked by hand (table above). A scripted production-build comparison is **deferred** (stage 4) | smoke desktop (5 new checks) |
| P1 | real, **fixed** | New `live` field on the decision (fights, the raid / rout, minigames, the finale). When the loop wakes from any hold, `wakeCare()` decides what happens. If the scene has a pause route, the pause menu opens. If it has none (finale, minigames), the loop stays asleep behind a "PAUSED · Tap to carry on" card (the new `resume` hold) until a tap. Town carries straight on | dungeon: hidden → pause menu, HP 90 → 90 over 2 s; upright → sideways → pause menu; card + tap |
| P2 | real, **fixed** | `rankFollowerLast()` (observe.ts) wraps the Hub follower's `enabled()`: "Shove Mikey" ranks below any other interactable in range, and still shows when he is all there is. No scene file edited | town: ENTER at the Krezz Arms with Mikey on top of you; SHOVE alone |
| P3 | real, **fixed** (research C9) | A control goes see-through in place while the player, the prompt bubble or the prompt's target is under it: no background, a faint ring, the word still readable, still pressable, pressed state still shown. It does not move, so the thumb keeps its place. I did not anchor it further into the gutter: with a 47 px inset only 29 px of gutter is inside the safe area | phone: iPhone insets, player at the console → ACTION `see`, slot unchanged (shot `phone-home-action-see-through.png`) |
| P4 | real, **mostly fixed** | Every `toast` title / text goes through `hint()` (a G listener placed first in line; `ping`, the characters' messages, never). New rules: "Esc for menu" → "II for the menu"; the Enter gate's "PRESS ANY KEY" → "TAP TO START" and "OR CLICK / TAP" hidden. Home's narrated "TIP: WASD..." line goes through the dialogue box and is **left** (rule 3; coordinator's call). The extra first-time touch cue is **deferred** (stage 2) | unit (toasts, gate); phone (gate says TAP TO START); town (the KRELFORD toast drawn in touch wording) |
| P5 | real, **mostly fixed** | A quick still tap on the thing the prompt is about uses it. Inside the stick zone this is the zone's tap rule; outside it the target has its own tap area (only the part outside the zone, below the HUD strip). The area sits around the spot and reaches further up than down. Home, the Hub and Kreddle's spots have targets. The Club, the Venue and Kreddle's people are **deferred** (stage 3) | phone: tap the trophy shelf itself (in the zone) and the console (right half) → both open |
| P6 | real, **fixed** | Android steps that go through the browser's menu (written steps, the in-app card) leave the game's fullscreen while they show. Closing the guide with a tap goes back into fullscreen (that tap is the user gesture). Fullscreen arriving while such steps show re-checks | android + guide sections |
| P7 | real, **mostly fixed** | In an app's own browser the in-app card shows itself as soon as the phone chunk is in: over the loading, and over the turn-your-phone screen in its upright layout. Its dismiss button says PLAY HERE ANYWAY. Holding the 106 MB load until then is **deferred** (stage 3) | android: Messenger 390x844 → card up while still loading |
| P8 | real, **fixed** (same fix as R1) | – | – |
| P9 | real, **deferred** (stage 2) | The new combat controls replace the old pad; the decision's `stick` field is how they keep the town's zone | – |
| P10 | real, **deferred** (stage 2, HUD layout) | – | – |
| P11 | real, **fixed** | The read-out starts on the right below pause and is `pointer-events: none`; only its MOVE tab takes touches. Wherever it sits, the controls under it keep working | guide: pointer-events, position, MOVE moves it |
| P12 | real, **deferred** (stage 2) | Readability is off by default; raising the floor without the layouts only adds overflows | – |
| P13 | real, **fixed** | The idle stick (and MOVE) shows until the player has walked with it; after that it fades 2.5 s after the thumb lifts. A tap does not bring it back | phone: idle stick gone after walking |
| P14 | real, **mostly fixed** | `VERB_OVERRIDES`: the bridge both ways GO, Polson Towers VISIT, the Kreddle Exchange ENTER, the machines PLAY / SPIN, vending BUY, Rummage SEARCH, Inspect / Examine LOOK. The word on a control is measured and fitted to 70% of the face. The title button's 35 px height is **deferred** (stage 2 menus sweep / readability snap). The bubble's tap area is already 46 px tall (bubble + 8 px) | unit (verbs) |
| P15 | real, **fixed** | iPhone Safari card: "No **Add to Home Screen** in the list? Tap the compass (or "Open in Safari") first." In-app card: "Or "Open in browser" / "Open in external browser"". Still fits without scrolling at 844x390, 740x360 and 750x340 | guide section (scroll 0) |
| P16 | real (pre-existing), **deferred** (stage 2 menus) | – | – |
| R1 | real, **fixed** | Nothing inside the stick zone takes touches but the zone (research M4). The bubble and target elements are clipped to their parts outside the zone (`outsideZone`). Inside the zone, a touch that moves is the stick. A quick still tap on the bubble or the target is ACTION; anywhere else it is handed to the game as before | phone: a drag from the bubble inside the zone walks; a tap on it uses the shelf; unit `outsideZone` |
| R2 | real, **fixed** | The open guide is a shell hold (`guide`): the loop sleeps under it from wherever it was opened. Closing it goes through `wakeCare` (a fight: the pause menu) | upright (rotate → guide → sideways: asleep until closed); dungeon (same mid-fight: frames and HP frozen, then the pause menu) |
| R3 | real, **fixed** | A back pauses where the game can, and does nothing where it can't; the guard goes straight back up, and again on the next touch if the browser skipped it. A back while the pause menu (pause mode) is showing leaves the game | phone: Back twice on the title and twice in a conversation, no touch between → page and scene stay; Back in the pause menu leaves |
| R4 | real, **fixed** | A capture-phase `touchstart` notes touches that began on the Enter gate; their `touchend` asks for fullscreen and arms the guard wherever it ends | android: press held 1.3 s (ends on the title) → fullscreen `#game`, history +1, gate and guard set |
| R5 | real, **fixed** | The store keeps only the settings the player chose (`{ v: 2, buttonSize: "L" }`). A later change to a default reaches everyone who never chose that setting; a player who set it keeps it. Reset forgets every choice. A version 1 object counts only values that differ from version 1's defaults (frozen copy). README step 2 corrected | unit: change one key, flip the default (`setPhoneDefaultsForTests`), reload; v1 migration; reset |
| R6 | real, **fixed** | The Hub adapter reports `sub: "shove"` while the shoving match runs; the walk rule shows ACTION = SHOVE with no prompt | town: SHOVE shown, pressing it shoves |
| R7 | real, **fixed** | `sameDecision` compares every own key (shallow), so a field a stage 2 rule adds reaches controllers when only it changes. `ModeDecision` allows extra fields | unit; phone: a rule's `tick` 1 → 2 reaches a registered controller |
| R8 | real, **mostly fixed** | `ModeController` gains `layout` and `rearm`. Several controllers per mode (by id, warning on replacement; `mode` defaults to `id`, so stage 1's documented form still works). New public `layer.addControl(spec)` / `TouchControl`, built on the same code as the four built-in buttons (they now use it): ownership by touch id, arming, pressed ring, buzz, `onDown` / `onUp({cancelled, ms})` inside the touchend, `onSlide`, re-placed on every layout, see-through. The stick zone and stick kind come from the decision (`stick: "2d" | "x"`; `.kt.stick`); an x-only stick reaches full speed at 35%. **Deferred** (stage 2): the per-side "nearest within 20 px" surface, and the aim-assist decision (recommendation in the README) | phone: controller laid out again on a left-handed change; unit (x stick) |
| R9 | real, **fixed** | `releaseAll()` also lets go of the old canvas pad (`releaseLegacyPad`: TOUCH stick / attack / held zeroed, the pad's stick id reset), always, so it also works while a conversation is over a fight | dungeon: old stick and ATTACK held, page hidden → both let go |
| R10 | real, **fixed** | Disarming is per finger (touch id), not per button. A finger that was down when the layer let go is owned and does nothing until it lifts; a new finger works at once. `rearm()` gives only the short 160 ms pause | phone: a control held through blur / focus, lifted, then two taps → both press |
| R11 | real, **deferred** (stage 2) | – | – |
| R12 | real, **fixed** | The shell's MutationObserver moves anything appended directly to `<body>` with `position: fixed` (the crash guard's notices) into `#game`, the fullscreen element | android: `notice()` in fullscreen lands in `#game` |
| R13 | real, **mostly fixed** | Smoke: 4 new sections (town, dungeon, android, and laptop checks inside desktop). New checks in phone / upright / guide (see the table rows). Every `check(name, true)` replaced by a check on the state waited for. The real `env()` safe-area path tested through CDP. Unit tests for the settings shape and default flip, extended decisions, the x stick, zone clipping, toasts. 4 and 5 simultaneous touches, and touch-driven Club / Venue / Kreddle, are **deferred** (stage 4) | – |

## What changed in the API (for stage 2; the README has it all)

- `ModeDecision` gains `live` and `stick`, and may carry extra fields.
- `registerModeController({ id, mode?, enter, frame, layout, release, rearm, leave })`. Several per mode;
  `unregisterModeController(id)`.
- `layer.addControl(spec)`, `layer.control(id)`, `layer.removeControl(id)`, `TouchControl`.
- Shell holds: `portrait`, `hidden`, `guide`, `resume`; `wakeCare(decision)`; `shell.setHold()`.
- Flag: `TABLET_MIN_SHORT_SIDE` (replaces `PHONE_MAX_SHORT_SIDE`); `rememberPhoneMode()`; `tabletOrComputerUA()`;
  `MobileEnv.ua`. `MobileWhy` gains `tabletUA` and `note`; `resolveMobile()` returns `by` and `note`.
- `boot.ts`: what the game's own files import (`installMobile`, `homeScreenEntryWanted`, `openHomeScreenGuide`).
- Settings: `chosenPhoneSettings()`, `cleanSetting()`, `chosenFromStored()`, store `v: 2` (only chosen keys).
- `window.__krelMobile.shellState()` and `.api` (the game's own module instances, for tests).
- Smoke: `--only phone,upright,settings,read,guide,optout,town,dungeon,android,desktop`.

## Dialogue and text

No dialogue or story text was changed. The new touch wording applies to toasts (system hints; characters' "ping"
messages excluded), to the Enter gate's two captions, and to ACTION's verb map, which never changes the scene's text.
Left exactly as they are, as lines that are said or narrated:
- Home's welcome "TIP: WASD / arrows (or the stick) to walk. E to use things."
- Kreddle's "TIP: talk to the locals (E)..."
- Mikey's "Press V (or the SANMIK button)"
- Wildern's arrival "CONTROLS: WASD move..."
- the raid's "HOLD the attack button (mouse / J / the fire button)..."

## Judged against "mega intuitive and fun"

Better than before this round:
- A friend opening the group-chat link in Messenger is told to open it in Safari before the long load, not after it.
- On Android the guide's steps can actually be followed.
- A notification or a tilt mid-fight no longer costs health.
- A stray Back no longer drops anyone out of the game.
- Tapping the TV, the trophy shelf or the console does what "Tap: ..." promised.
- With Mikey in tow, the door says ENTER.
- The shoving match works by touch.
- The resting stick ring goes away once you've walked.
- ACTION no longer hides the player in the corner.
- The first town message speaks touch.
- Tablets and touchscreen laptops are back to exactly today's game, and laptops download nothing new.

Still not there, all in later stages:
- Fights are still on the old canvas pad (stage 2), so the gutter does nothing there.
- Text is small until stage 2 turns readability on.
- The top-right corner is crowded with real insets.
- Character select commits on the first tap.
- Tap-the-thing doesn't yet reach the Club and the Venue.

## Files

- Code: `src/game/mobile/{boot,flag,shell,touchLayer,observe,modes,layout,settings,wording,homeScreen,diag,css,index}.ts`
  and `README.md`. Outside the folder, import paths only: `src/main.ts`, `TitleScene.ts`, `MenuScene.ts`.
- Tests: `tests/desktopNotPhone.test.ts` (new) and `tests/mobile{Flag,Modes,Layout,Settings,Wording,HomeScreen}.test.ts`.
- Safety net: `scripts/desktop-fingerprint.cjs` and `scripts/fingerprint/core.cjs` (`--profile`),
  `tests/fingerprints/profiles/*` (new baselines from the base source), `tests/fingerprints/README.md`.
- Smoke: `scripts/mobile-smoke.cjs`.
- Scratch: `scratchpad/mobile/work/fix1/`.
- Screenshots (from the final smoke run, 1x CSS): `scratchpad/mobile/shots/fix1/smoke/`. The new ones are
  `phone-home-action-see-through.png`, `dungeon-back-paused.png`, `dungeon-carry-on.png`,
  `android-guide-left-fullscreen.png`, `inapp-card-during-load.png` and `town-hub.png`; the rest are the smoke test's
  usual set.
- Deferred items: `reports/DEFERRED.md`.

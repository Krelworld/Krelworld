# Stage 2, part 2: side rooms and jumping, brawls, finishers, controllers

Worktree `scratchpad/mobile-wt`, branch `mobile`. This run picked up after a usage cut-off: the earlier run had made no
commits, so everything below is new. All of it is phone-only (`isMobile()`); the laptop checks are at the end.

Commits (oldest first):
- 41dbfdc5 Phone side rooms: JUMP in the corner with buffer, coyote and tap-to-hop; x-only stick, FIRE beside JUMP, look-ahead camera
- 9246f67e Phone side rooms: a tap's hop is the same height at any frame rate; smoke test for jumping by touch
- 240a3d36 Phone fights: big PUNCH / BLOCK / VANISH / KICK / KI for the finale brawl, tap anywhere for its rush, a big KRELTALITY button
- 937aab23 Phone: a Bluetooth controller takes over (touch controls hide), the next touch brings them back; its right stick aims
- 6c3c708a Phone: pause → CONTROLS shows a labelled picture of the touch controls (walking, fights, side rooms, brawl)
- 6c8b2aa9 Phone fights: fullscreen offer in fights (Android), brawl wording without keys, smoke tests for the brawl and the Kreltality prompt
- 920701c3 Phone module README: side rooms and jumping, the brawl, the Kreltality prompt, controllers, the Controls picture
- (see git log for any later fix commits)

## 1. Side-scrolling rooms (`combat.ts` mode `side`, `side.ts`, `jump.ts`)

Every side room is covered by one rule (the Dungeon with `side` true): the Crobley factory (Factory Floor, Packing
Line, Sausage Works, Showcase, Core), the SanMik Zone (Begour's Café, Catford High Street, Job Centre Plus and its car
park, the Nu Warehouse trip, the Giant Hot Tub; also the hangout's café), the Ministry's Cuddle Tower, the citadel's
Drongus Corridor, Ascent, Anthem Corridor, Final Stairs and Top of the Tower, the plane (Aisle, Cockpit) and the colon.
The old canvas pad is gone from all of them on a phone (UIScene's `Dungeon.side` condition dropped).

Layout v2 as the research gives it: JUMP 84 px in the prime corner (touch area to the corner), FIRE 60 px left of it,
DODGE and SPECIAL above in the same places as top-down rooms, READY / HEAL / ACTION / weapon chip / drink chips from
part 1. No SWAP button in side rooms (the weapon chip does tap = next, hold = picker): that is the layout v2 table,
which gives SWAP's slot to FIRE. The stick is `"x"` (left / right only, full speed at 35% travel). Aim is facing plus
auto-aim, no slide-aim (research). Auto-fire is the same setting as top-down rooms and on by default (M1).

### Jump feel (phone only; the game's gravity 1500, take-off 660 / 580 and run speed unchanged)

| | Laptop (unchanged) | Phone |
|---|---|---|
| Trigger | W / Up / stick up | JUMP on touch-down |
| Buffer | none | 150 ms |
| Coyote | 110 ms | 140 ms |
| Height | always full | tap = hop, hold = full (cut to 300 px/s, air jump 260, at the later of release and 80 ms) |
| Double jump | release and push up again | second press of JUMP |
| Air control | 140 ms easing | 100 ms |
| Drop-through | stick down past 0.6 | stick held down past 0.7 (sideways under 0.35) for 150 ms, or stick down + JUMP on a platform |
| Platform landing tolerance | 14 px | 20 px (phone assist) |
| Ledge pop / corner correction | none | 8 px pop (tops 4 px wider), corner nudge up to 40% of the body (phone assist) |
| Moving platform | carried while on it | speed kept 100 ms after leaving it |
| Crushers / steam reach | art-sized | x0.88 (phone assist) |
| Camera | lerp 0.12, 80 x 60 dead zone | dead zone 0 x 200, player at 35% / 65% (offset -/+144), turns after 0.4 s, view leads 60 px down when falling |

Phone assist off gives the game's coyote (110), a one-frame buffer (40 ms), the game's air easing, the game's 14 px
tolerance and no pop / nudge / hazard shrink, but keeps tap = hop (that is the control, not an assist).

One finding while measuring: the first hop cut read the release on the next frame, so a slow frame made a tap jump
higher (108 px in the loaded test browser). The cut is now worked out from the height already climbed (the remaining
climb is set so the apex lands where an exact cut would put it), which makes the hop the same at any frame rate.

### Measured jump numbers

Unit simulation (`tests/mobileJump.test.ts` model: the game's update at the display rate, Arcade physics at its fixed
60 Hz step, the game's gravity and take-off speeds):

| Display rate | Tap (one frame) | Tap 50 ms | Released at 200 ms | Held | Longest buffered press that still jumps on landing | Longest coyote that still gives the first jump |
|---|---|---|---|---|---|---|
| 10 Hz | 86 px | 86 px | 129 px | 140 px | 100 ms | 100 ms |
| 30 Hz | 76 px | 76 px | 129 px | 140 px | 130 ms | 133 ms |
| 60 Hz | 76 px | 76 px | 135 px | 140 px | 145 ms | 133 ms |
| 120 Hz | 76 px | 76 px | 129 px | 140 px | 140 ms | 133 ms |

(Buffer and coyote are quantised to frames: 150 / 140 ms are the limits. Held is 140 px rather than the closed-form 145
because of the fixed-step integration; the laptop's full jump is the same 140.)

In the browser (smoke section `side`, iPhone 14 profile, real CDP touches, a loaded 4-CPU test machine): tap 76-92 px
over runs (92 when the machine was at load 8), hold 140 px; a press 30 to 45 ms before landing waited in the buffer and
fired on landing; a jump pressed 105 ms after leaving the ground was the first (full) jump and one pressed 377 ms after
was the air jump; every jump read the press one frame later (about 30 ms on this machine: the press is read on the
Dungeon's next frame).

## 2. Brawls, finishers, prompts (`brawl.ts`)

- **Finale Super Saiyan brawl**: one guarded line in `SsjBrawl.inputs()` hands the controls to the phone layer, which
  shows PUNCH (prime, 84 px), BLOCK (hold), VANISH, KICK, KI (hold) with captions, and the town's floating stick. They
  feed the brawl's own `pad.edges` / `pad.held`, so every hit, freeze, shake and cheer is the game's. During the
  finishing rush the buttons hide and the whole screen is a mash surface (every finger = a punch); "MASH PUNCH!" reads
  "TAP TAP TAP!" on a phone. Fixed during testing: the brawl was forgotten during its intro, so the controls never came
  up; now it is only forgotten after it has run and ended.
- **Krezz Arms pub brawl**: nothing to build. The Pub is mode none on a phone (every touch reaches the canvas, which
  swings on any tap), and its line already reads "BRAWL! Tap to swing" through the stage 1 wording. Not run end to end
  this time (see gaps).
- **Kreltality prompt** (any fight): on a phone its two canvas buttons drop the key names ("☠ KRELTALITY",
  "spare them"), and a big pulsing ☠ KRELTALITY (1.25 x the prime slot, 105 px on an iPhone 14) sits under the right
  thumb with SPARE at the ACTION slot. The game's own buttons still work. A tap on the big one says yes (smoke).
- **WONK / group wonk mash** were done in part 1 (the mash overlay). The Kreltality cinematic itself skips on a tap
  as before.

## 3. A controller on the phone (`pad.ts`, DEFERRED R11, research S6)

Polled each game step. The first button press or stick push past 0.35 sets the input source to `"pad"`: the decision
carries `input: "pad"`, the layer root gets `padin` and every touch control hides. The next touchstart anywhere brings
them back. In fights a pushed right stick aims (a guarded line in `Controls.aim`'s existing phone block; the phone's
auto-aim steps aside). Note for the phone settings page (the other builder renders it): `PAD_NOTE` in
`controlsPicture.ts`: "A Bluetooth controller works: press any button on it and the touch buttons hide. Touch the
screen to bring them back." (The same line is the Controls picture's footer.)

## 4. The Controls picture (`controlsPicture.ts`, research S10)

The menu's CONTROLS on a phone opens a full-screen picture of the screen with every control drawn where the layer
really places it (`layer.slots`, the placed weapon chip and pause, the stick zone), numbered, with one plain line
each, in tabs WALKING / FIGHTS / SIDE ROOMS / BRAWL; it opens on the tab for the fight under the pause menu; CLOSE goes
back to the menu. Screenshot: `scratchpad/mobile/shots/s2-combat2/side-controls-picture.png`.

**Pause-menu hook (for the merge with the PHONE SETTINGS builder):** I added no row. The only change in
`MenuScene.ts` is the first line of `openControls()`:
`if (isMobile() && phoneHooks()?.controlsPicture?.()) return;` plus `phoneHooks` added to the existing
`import { homeScreenEntryWanted, openHomeScreenGuide } from "../mobile/boot";`. The existing CONTROLS row (pause list)
and CONTROLS button (settings page) both reach it.

## 5. Fullscreen re-offer in fights (Android)

The layer's fullscreen offer (after leaving fullscreen on Android) now also shows in combat / side / brawl (not over a
mash or the picker), at a new `fullscreenFight` slot under pause, clear of the weapon chip and READY (smoke checks it
overlaps no control).

## 6. Every hook outside `src/game/mobile` (all `isMobile()`-guarded)

| File | Change | Why |
|---|---|---|
| `src/game/combat/Player.ts` | imports; `} else if (side && isMobile() && phoneHooks()?.sideMove?.(...)) { } else if (side) {` | the phone's jump feel; the laptop's side branch is untouched |
| `src/game/scenes/DungeonScene.ts` | one-way callback `pb.top + (isMobile() ? (phoneHooks()?.ledgeTol?.() ?? 14) : 14)` | 20 px landing tolerance (phone assist) |
| `src/game/scenes/side/SideLevel.ts` | imports; crusher and steam reach `* (isMobile() ? (phoneHooks()?.hazardScale?.() ?? 1) : 1)` | smaller hazard reach (phone assist) |
| `src/game/scenes/UIScene.ts` | `setupTouch()`: `if (isMobile()) { destroy the old pad; return; }` (the `Dungeon.side` condition dropped) | side rooms on the phone layer |
| `src/game/scenes/finale/SsjBrawl.ts` | imports; `if (this.touchUi && !(isMobile() && phoneHooks()?.brawl?.(this))) this.touchPad();` | big brawl controls |
| `src/game/combat/Kreltality.ts` | imports; labels `isMobile() ? "☠ KRELTALITY" / "spare them" : <as before>`; `closePhone = isMobile() ? phoneHooks()?.finisher?.(...) : null` and `closePhone?.()` in `done()` | no key names; one big target |
| `src/game/combat/Controls.ts` | inside the existing `if (isMobile())` block of `aim()`: a pad's right stick past 0.5 aims | controller on the phone |
| `src/game/scenes/MenuScene.ts` | first line of `openControls()` and the `phoneHooks` import | Controls picture |

The fingerprints confirm the laptop and the tablet-class devices are unchanged (section 9).

## 7. Wording (UI only; no dialogue touched)

Lines swapped on phones only, through `addWording` / `wordText` (`BRAWL_WORDING`, UI_TEXTS.Finale):
- Finale boss card (system UI): "MASH FOR A FLURRY. HOLD R TO BLAST KI. VANISH BEHIND IT." → "MASH PUNCH FOR A FLURRY.
  HOLD KI TO BLAST. VANISH BEHIND IT."
- Finale corner hint (system UI): "Esc: skip fight" (and "Esc: skip scene") → hidden.
- Finale rush prompt (system UI): "MASH PUNCH!" → "TAP TAP TAP!"
- Kreltality buttons (UI): "☠ KRELTALITY (K)" / "(K / Ⓐ)" → "☠ KRELTALITY"; "spare them (ESC)" / "(ESC / Ⓑ)" →
  "spare them" (a guarded ternary in the prompt, not a wording rule).

No narrator tip lines were swapped by me. Character lines that mention a key: I found none in the brawl, the side
rooms or the Kreltality prompt. Part 1's list (dungeons.ts Wildern CONTROLS narration, bosses.ts Cronster TIP) stands.

## 8. Tests

- Unit: `tests/mobileJump.test.ts` (new, 28 tests): hop vs full at 10 / 30 / 60 / 120 Hz, release half-way, buffer
  (120 ms early jumps on landing, 200 ms early is forgotten) and coyote (130 ms late is still the first jump) at 30 /
  60 / 120 Hz, coyote 140 / 110, air jump after coyote, double jump, reset, drop-through (drift never, held 150 ms
  yes, chord on a platform only), landing tolerance, ledge pop, corner nudge, air easing, camera look-ahead, pad
  detection, the decision's `input` field. `tests/mobileCombat.test.ts`: the side rows updated.
- Smoke: new sections `side` (19 checks: controls and layout, x stick, JUMP on touch-down, hop vs full, buffer, coyote,
  deliberate drop-through, no stuck jump across a mode change, auto-fire, camera, the Kreltality prompt, fullscreen offer
  in a fight, pad handover both ways, Controls picture and its tabs) and `brawl` (6 checks: brawl mode with no canvas
  pad, the five buttons, PUNCH on touch-down, BLOCK held / let go, the rush by tapping anywhere with its wording, no
  errors).

## 9. Verification

(filled in below)

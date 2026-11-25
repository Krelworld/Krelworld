# Stage 3, wave 1: tap to use (s3-tap)

Branch `s3-tap` (worktree `scratchpad/s3-tap-wt`), from `mobile` at 37a710d4. Phones only; laptop unchanged.

## What a player gets

In every walking scene (Home, the town, Kreddle, the Club, the Venue), a still tap on a thing or a person walks the
player there and uses it, like a point-and-click game:

- **Tap** the telly, the book, the gun rack, the console, the bed, the jukebox, the laptop, the trophy shelf, the
  window, the door out, the poster, a decor piece; in town a person, a door or the whole building it belongs to, a
  vending machine, the Tap, a TV, a rummage spot, the playground (throws a sweetie over the fence); in Kreddle a machine
  row (all four slot machines count), the Exchange, a local; in the Club the stage (tip), the bar, the wonk-off table,
  the exit, the booth, Alistair, a token, anyone you can swing at; in the Venue a performer or the exit.
- **At once** (inside the touch handler, so the same frame): a yellow ring on the thing with the prompt's own words
  in a small tag ("Watch KrelTV"), and a light marker on the floor where the player is heading.
- **The walk** is the scene's own walking: tap to use only writes the stick's numbers (`TOUCH.mx / my`), so speed,
  the drunk wobble, the slippery modifier and every collider are the game's. In town a 16 px grid route goes round
  the buildings (A*, 8 directions, no corner cutting, pulled straight); measured round the back of the Krezz Arms:
  4 waypoints, in 2.2 s, then in through the door. Routes take under 3 ms (unit test: a 160 x 112 town with 100
  buildings in under 60 ms; in the game the slowest route was 2.2 ms). Never a teleport.
- **On arrival**, when the scene's prompt names the thing, the same edge ACTION sends uses it, and the ring flashes
  white. Already in reach: used straight away. No route at all: it walks as near as it can and stops; the prompt shows
  what is there.
- **Stops at once**: the stick moving past 15% of its travel (the stick takes over that frame), a conversation, menu,
  cutscene or panel (the layer's mode leaves "walk"), the page hiding, the thing going away, 15 s. A second tap on
  something else re-targets. Someone walking about is followed (re-routed when they move 24 px).
- **The floor**: a tap on empty floor walks there (the research's choice; in testing a stray thumb that moves is the
  stick, and a still tap is deliberate, so it was not annoying). Not from the HUD strip along the top, not onto
  yourself.

Kept from stages 1/2: tap the prompt bubble = ACTION; stage 1's generous area round the thing the prompt is about
(around its spot, reaching further up than down) is still ACTION where no thing is under the thumb (the trophy shelf
from just under it; the full check's `phone` section caught that the first build had dropped it); the ACTION button; the stick zone is the stick (a touch that
moves there is the stick; a still tap there on a thing uses it); a canvas button of the game's own under the tap (the
Club's UP CLOSE, a panel) gets the tap as before (`gameWants`). The old "tap the prompt's thing" area gives way in
these scenes (it would have taken taps meant for a neighbour); its "core" still makes controls see-through.

## Target picking (tapLogic.pickTarget)

Each thing can be tapped within its picture grown to at least 44 CSS px, plus 6 px. Inside a picture beats near one;
inside several, the smallest picture wins (the book lying on the bed; the laptop on the sofa); near several, the
nearest. A follower at your side (Mikey) only counts when nothing else is there. The player figure is never a target,
so a thing behind the player is tapped through them. The HUD is not interactive in these scenes, so it never takes the
tap either (a game button would: `gameWants`).

Order of rules for a still tap: a game canvas button under it (the game gets it) → a thing → stage 1's area round
the prompted thing (ACTION) → the floor.

Pictures: Home's spots by their words → the furniture's own texture bounds (`p_tv`, `p_bed`, `p_gunrack`,
`p_dark_autism`...) or a box from the backdrop (window, door out, poster). Town interactables → the person's sprite, or
the spot's box joined to the collider it stands at (`standsOn`), so the whole building enters. Kreddle machines → the
union of their texture row. Club places → its zones. People → their sprites.

## Scene by scene

| Scene | How |
|---|---|
| Home | spots; floor x 40-920, y 455-536; no colliders |
| Hub (Krelford) | interactables (doors, people, machines, rummage, the Tap, TV, the playground throw); colliders → grid route |
| Kreddle | spots (machines as image rows) + locals (a local inside a machine's reach is talked to from beside them, clear of it: `besideClear`); not the raid / rout (fights) |
| Club | stage, bar, table, exit, booth, token, Alistair, the lads / band / Big Derek |
| Venue | performers, the exit |
| Pub, Pit, PitLoan, PolsonHome, Lair | already tap-through card screens (mode "none"): nothing walks there; their cards are tapped directly. Polson Towers is a door in town |

**P5 remainder closed**: `observe.promptTarget` now covers the Club, the Venue and Kreddle's people through
`tapTargets.promptThing()` (the thing the prompt names, nearest the player), so controls over it go see-through there
too, and tapping it uses it.

## Files

New, all in `src/game/mobile/`: `tapUse.ts` (the controller, DOM ring / tag / marker, canvas taps, steering, cancels),
`tapTargets.ts` (per-scene readers), `tapLogic.ts` (pure: pick, grid, A*, steer). Changed: `touchLayer.ts` (a
`worldTap` field; `zoneTap` asks it before `injectTap`; `updateTaps` drops the old target tap area where it covers),
`observe.ts` (promptTarget fallback), `index.ts` (install, CSS, `__krelMobile.tapUse`), `README.md` (a "Tap to use"
section, file table, input rules, testing). `scripts/mobile-smoke.cjs`: section `tapuse`. `tests/mobileTapUse.test.ts`
(21 tests: picking, grow / distance, path-finder incl. walls, blocked goals, no route, squeezed start, corner cutting,
a big town's speed, steering and a simulated walker, tag / standsOn / spotBox).

**Hooks outside `src/game/mobile/`: none.** index.html, main.ts, the Phaser config, the scene list, every scene file,
`tests/desktopInvariants.test.ts` and `tests/fingerprints/` are unedited. The touchLayer change is in the phone chunk.

**Merge note (mobile-feel)**: my `touchLayer.ts` edits are three small blocks away from the stick code that branch
changes (a field after `onLayout`, one line in `zoneTap`, two lines at the end of `updateTaps`'s target trim). I read
`layer.stickRaw` (public, kept by that branch) to let the stick take over.

## Wording

No line swapped, none added. Every phone-only touch wording line about using things, checked against tap to use:

- Home's narrator tip "TIP: Drag on the left to walk. Tap things to use them." (stage 2 N6): now true everywhere.
- "...Walk up to it and tap it." (the telly, the gun rack): true (walking up is now optional).
- "...walk to each 📸 camera in the playground and tap to snap it" / "Stand by the fence and tap to throw a sweetie":
  true: a camera is a target; the playground is a target that walks to the fence (outside the kids' sight) and throws.
- Kreddle "talk to the locals (tap them)": true.
- The town's first toast "Drag on the left to walk. Tap to talk/interact. ...": true.

Character lines that mention a key: unchanged, the same list as stage 2 (s2-04): DRONGUS "Press 1 for...SWASTIKA"
(riffs.ts:377), DRONGUS "(Y)" (riffs.ts:410), Drongus statuses "(Y)" and "pressing the "0" on his phone's keyboard"
(drongusStatuses.ts:27, :81), KREZWONK "I'm going to press a button..." (chapters.ts:298), CLAUDE "...The way the key
change happens..." (ch7.ts:19), the gig heckle "NOT DURING THE KEY CHANGE!" (citadel.ts:112), the minigame group chat's
"(Y)" lines (MinigameScene.ts:1235, :1238). None is a control instruction.

## Checks

During the work: tsc, the new unit tests, `--only tapuse` on the iPhone profile with its 47/47/21 insets (32 of 32).
Full check at the end: see the bottom of this file.

## Judged against "mega intuitive and fun"

Better: a friend picks up the phone at Home and taps the telly; the player walks over and it comes on. No stick, no
button, no sentence of explanation. The ring tells you at once what you tapped, by the game's own words. In town you
tap a building and walk round to its door. People get talked to by tapping them.

Not yet / honest notes:
- With a prompt up, ACTION sits over the console in Home's bottom-right corner (iPhone landscape) and wins there (the
  controls win where they are drawn, so the thumb's button is never second-guessed). The console can be tapped when
  ACTION is not up, or walked to.
- Tapping a person in the Club means swinging at them (that is the scene's own prompt, "E / ATTACK: hit X").
- In Kreddle, standing at a machine always shows the machine (the scene's rule); a local inside a machine's reach is
  talked to from beside them, outside it; one standing right in front of the slots can still lose to them.
- The first-run idle stick hint can sit over a tapped thing on the far left at Home (it moves off the player, not off
  the ring) for the few seconds until the player has walked once.
- Needs a real-phone feel check (stage 4): walking speed is the scene's (210 px/s), so a far tap at Home takes about
  3 s; that is the game's pace, deliberately not sped up.

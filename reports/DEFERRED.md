# Deferred from review (for the stage named on each item)

Every item here was confirmed real by the fix round named, and belongs to a later stage's work. None affects a laptop.
Each line: where it came from, what is wrong, what the stage should do. Ids are the reviewers' (see
`04-fix-round1.md` for the evidence and for everything that was fixed instead).

## Stage 2: combat HUD and controls

- **P9 (round 1).** In the dungeon (still the old canvas pad) a drag that starts in the black gutter does nothing; town
  teaches that it works. The new combat controls must keep the town's zone: register the combat rule with
  `stick: "2d"` (side rooms `"x"`) and `legacyPad: false`, so the layer's zone (gutter included) is the stick.
- **R8 remainder (round 1).** Done in round 1: `layout` / `rearm` on controllers, several controllers per mode,
  `layer.addControl()` (ownership, arming, pressed ring, buzz, slide, layout, see-through, disarm by touch id), the
  stick zone and stick kind from the decision (`stick: "2d" | "x"`, x-only full speed at 35%). Left for stage 2:
  research M3's per-side surface ("a touch in a gap goes to the nearest control within 20 px") for the right cluster,
  if the per-element boxes prove too tight on a device.
- **R8 item 7 (round 1): aim assist has two switches.** The game's `G.meta.settings.autoAim` ("Touch aim assist" row,
  shown on phones because `TOUCH.enabled` is on) and the phone settings' `aimAssist` (off / normal / strong).
  Recommendation (README): on phones the combat hook reads `phoneSettings().aimAssist` only, and the phone settings
  page is where it changes; the game's own row stays for tablets. Decide before wiring either.
- **R11 (round 1): a controller connected to the phone.** Nothing in phone mode looks at gamepads: the idle stick,
  MOVE, ACTION and pause stay drawn, the dungeon keeps the 12-button old pad, and `Controls.aim()` takes the touch
  path (`TOUCH.enabled && activePointer.wasTouch`), so the pad's right stick never aims. Add an input source to the
  view / decision (`input: "touch" | "pad"`): the first pad button or stick movement hides `.kt` and the old pad, the
  next touchstart brings them back; the guarded hook in `Controls.aim` should prefer the right stick when it has moved.
  Say "a Bluetooth controller works" on the phone settings page.
- **P10 (round 1): the top-right corner is crowded.** With the real iPhone inset, pause (745-797 x 6-58) covers the ends
  of the top-right toasts and the objective column, and in Kreddle the second HUD counter; on Android the fullscreen
  offer plus pause cover the toasts' right ends. Lay the phone HUD out with the pause / fullscreen slots in mind (shift
  the toast column and the counters left by their width on phones, or move pause into the right gutter above ACTION).

## Stage 2: menus, dialogue, readability, touch wording

- **P12 (round 1): readability.** With `?mobileread=1` the smallest text is 10.1 CSS px (the floor); research M7 says
  11 for labels and 16 for reading (dialogue body stays 11.6). Two overflows it causes: the pause menu's objective line
  wraps into the RESUME row; on character select "Proctus covers as: ..." overlaps '"I'll go first."'. Raise
  `MIN_TEXT_CSS` to 11 when the layouts are fixed (behind `isMobile()`), and plan 16 px for dialogue, choices and
  subtitles, before flipping the default (only chosen settings are stored now, so the flip reaches everyone).
- **P14 remainder (round 1).** The title's "📲 ADD TO HOME SCREEN" button is 202 x 35 CSS px (under 44). The menus
  sweep (or readability's 44 px tap snap, once it is on) should give it a 44 px tap area; its look and place on the
  title are a menu-layout decision. (The verbs and the ACTION word fitting were fixed in round 1; the prompt bubble's
  tap area is the bubble plus 8 px on every side, 46 px tall.)
- **P16 (round 1, pre-existing): character select.** The first tap on a face commits the choice (straight to
  Difficulty); PLAY AS is never needed. On phones a tap should select and preview, and PLAY AS confirm (audit plan).
- **P4 remainder (round 1).** Fixed: the town's first toasts, the side-quest toast and every other toast that names a
  key (through `hint()`), and the Enter gate (TAP TO START). Left: (a) Home's narrated welcome line "TIP: WASD / arrows
  (or the stick) to walk. E to use things." goes through the dialogue box, so it was left as it is (rule 3): the
  coordinator decides whether it counts as dialogue; (b) a first-time touch cue in the moment (research: pulse the stick
  ring and ACTION the first time each matters) beyond today's MOVE caption and ACTION's pop.
- **R3 follow-up (round 1).** Back now pauses where it can and does nothing elsewhere; a back while the pause menu shows
  leaves. Stage 2 may map Back to SKIP in conversations and to "close" on overlays.

## Stage 3: every minigame and scene, sound, memory, performance

- **P5 remainder (round 1).** Tapping the thing a prompt is about now uses it in Home, the Hub and Kreddle (its spots);
  the Club, the Venue and Kreddle's people still need an adapter in `observe.ts` `promptTarget` (their prompts are
  worked out in the scenes' own code). Until then the bubble and ACTION work there.
- **P7 remainder (round 1).** The in-app card now shows straight away (over the load and the rotate screen), but the
  game's art (about 106 MB) still loads behind it. Consider holding the heavy load in an in-app browser until the
  player taps PLAY HERE ANYWAY (it is loaded again in Safari / Chrome anyway).
- **Minigames and the finale have no pause route** yet: coming back to one shows the carry-on card (round 1, P1).
  Stage 3 should give each a pause (then `wakeCare` opens it instead, with no further change).

- **S2 review P5 (fix round 1): TV subtitles at reading size.** In the telly (TVScene) a long line at 16 CSS px wraps
  to four or five lines and covers the speaker. Fixing it means paging a subtitle over its beat (same words, 2-3 lines
  at a time) inside the TV scene's own beat timing, or a wider strip under the picture: TV scene work, which stage 3
  owns (the TV picture size was already listed for it). The story bulletins' NEXT SHOW now reads SKIP on a phone (P4).

## Stage 4: QA

- **L5 (round 1): foldables** decide once at load: opened folded (cover screen) it stays in phone mode after unfolding;
  opened unfolded it stays the tablet game after folding, until a reload. Check on a real Fold; if it matters, offer a
  reload prompt on a screen-size change (only when no `?mobile=` choice is stored) rather than switching live.
- **L7 remainder (round 1).** The production build was checked by hand in round 1 (main chunk +4 KB over the base,
  the phone chunk fetched only on a phone). A scripted production-build laptop check (base vs head boot: storage
  reads, media queries, requests, chunk sizes) would make that permanent.
- **R13 remainder (round 1).** The smoke test now covers the Hub (follower ranking, the shoving match, toasts), a
  dungeon (old pad across hidden, coming back to a fight, the guide from the rotate screen, the carry-on card),
  Android (long press at the gate, fullscreen and the guide, notices), Back on the title / in a conversation / in the
  pause menu, the bubble in the zone, tapping the thing, blur / focus on a held control, three fingers then a cancel,
  and the real `env()` safe-area path. Not yet: four and five simultaneous touches; tap-the-thing in the Hub by touch;
  the Club, the Venue and Kreddle driven by touch.

## Stage 3: the user's own requests (2026-11-25)

- **Manual aim where you can't move.** The user: "in certain parts of the game maybe test whether manual aim might be okay
  (I'm thinking the sanmik night of freedom sequence, where you can't move)". NIGHT OF FREEDOM is `DriveScene.ts` (SanMik
  drives, you're on the guns: endless machine gun plus ROCKET). With no stick needed, the whole screen is free for aiming:
  test a finger-is-the-crosshair scheme (touch and drag anywhere = aim there and fire; a ROCKET button in the corner)
  against auto-aim, play both, and pick what feels best. Apply the same test to every other "stationary gunner" section
  (the plane cannon, any turret or on-rails shooter), and say which scheme each one got and why.
- **Tap the thing to use it, from anywhere (TOP PRIORITY for stage 3).** The user: "on the phone I think like, you
  should consider areas where you can tap environmental things to interact with them in addition to being able to walk
  up to them. Seems like being able, to example, to touch things at home should allow you to interact with them".
  Today (stage 1, P5) a tap on a thing only works once you are already standing at it. Build: on phones, in every
  walking scene (Home first, then the Hub, interiors, the Club, the Venue, Kreddle, Polson Towers, the Pub and the rest),
  tapping any interactable thing or person (the telly, the book, the gun rack, the wardrobe, the fridge, the laptop, the
  bed, doors, NPCs...) walks the player there by itself and then uses it, like a point-and-click game. Show a small
  highlight on what was tapped. Walking with the stick cancels it. Taps on empty floor do nothing (or, if it feels
  right, walk there). Generous tap areas on small things (at least 44 CSS px). Laptop unchanged. Close the P5
  remainder (Club, Venue and Kreddle people) as part of this.
- **TV guide scrolling (check).** The user, on the live stage 1 build: "scrolling doesn't work in that screen, if you
  try to scroll it just plays the point in the screen that your thumb tries to scroll from". Stage 2's native-scroll
  TV guide should fix this: confirm on the iPhone profile by touch, from the title AND from a room TV, that a drag
  scrolls and never plays a show, and only a still tap plays.

## From the stage 2 review, fix round 1 (2026-11-25)

Stage 4 (judge on real phones; the coordinator may pull the first into a stage 2 round instead):
- **P12 remainder: long how-to text at 11.6 px.** The first dungeon's how-to card (6 rows, 2 lines each), the character
  bios and the difficulty descriptions sit at the 11.6 CSS px floor. At 14-16 px the card no longer fits above its
  NEXT button at 844x390 (rows grow about 20%), so it needs its rows split over more pages, and the bios / descriptions
  re-flowed. The SWAP wording was fixed in round 1.
- **P15 remainder: the home-indicator strip.** Captions and the conversation's ▼ now keep out of it, and the flyover's
  skip is a pill in the top bar. Still inside it: the bottom 7-10 px of the conversation box's frame (decoration, no
  words) and, in side rooms, the pit names drawn in the floor ("OPEN MANHOLE") and the damage number over a fall: the
  side room's view is the whole room's height, so the camera cannot lift them without a vertical camera change. JUMP and
  FIRE now go see-through over pits (P3), so the gap itself is never hidden.
- **Button size S on short screens (seen while fixing F5).** With size S below about 360 px tall, the 52 px minimum
  makes some cluster gaps 2-10 px (left/upLeft, upLeft/heal, up/ready). Pre-existing, unrelated to insets; check on a
  real small phone whether S should keep the M offsets once the minimum kicks in.

## USER FEEDBACK (live, from the user's iPhone, for track B / TV): long TV lines cover the whole picture
The user, verbatim: "Sometimes the text on tv shows obscures the whole screen - maybe it can be split into chunks for longer pieces?" Screenshots: /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/work/s3-scenes/user-tv-1.png (a Krunche News reporter line, 8 lines tall, covering the face) and user-tv-2.png (a 7-line speech).
Do on phones only: split a long TV caption into chunks of at most 3 lines (break at sentence or clause ends, never mid-word), shown one after another in the lower part of the screen, each for its share of the line's time (by characters) when the show auto-advances, with NEXT LINE stepping to the next chunk first. The words stay identical and in order (re-paginating is allowed; rewording is not). Keep the speaker name on the first chunk. The caption box must never cover more than the lower ~40% of the picture. Laptop unchanged. Smoke: the longest TV line at 844x390 never exceeds 3 lines per chunk and the concatenated chunks equal the original text.

# Stage 2 thumb-feel round: the user's own iPhone test

Branch `mobile-feel`, worktree `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-feel-wt`,
started from 37a710d4 (the polished stage 2). Every change is phone-only and lives in `src/game/mobile/` (no game file
was touched in this round). Commits (each ends with the two footer lines):

- f78fb1a5 Phone stick: the base stays where your thumb lands (no more sliding about)
- 03c91610 Phone fights: specials and drinks are full-size buttons under the right thumb
- 77e2dfe3 Phone side rooms: a quick tap clears the platforms; the camera no longer whips round
- 35872aca Phone smoke and README: the thumb-feel round (stick, pocket, jumping, pause)

The user's four points and what each became:

## A. STICK: "The joystick ... can slide all over the screen, if your thumb does"

Cause (stage 2 as built): the stick appeared where the thumb landed and then **followed** the thumb past its rim
(`followBase`), so a thumb that drifted dragged the whole stick across the screen, with nothing keeping it in the
stick zone.

Now (`settings.ts`, `touchLayer.ts`, `layout.ts`):
- **Default `stick: "stays"`**: the stick appears where the thumb lands and its base stays there for that touch. Pulling
  past the rim is full speed that way (the knob stops at the rim). Measured (smoke `phone`): a drag of 240 px from
  (120, 280) leaves the base at exactly (120, 280) with full speed (mx > 0.9). Before: the base would have been dragged
  184 px (240 minus the 56 px travel).
- Settings > Stick now offers **STAYS / FOLLOWS / FIXED** with the help line "Stays where your thumb lands, follows your
  thumb, or one fixed spot." (Longer labels such as "STAYS WHERE YOU TOUCH" overflowed the row off the screen at
  844x390, measured, so the words went into the help line.) FOLLOWS is the old behaviour, now kept inside the stick
  zone (`keepInZone`; smoke: a 400 px drag stops the base at the zone's edge, x 380). FIXED is unchanged.
- A stored `"floating"` (the old default) reads as `"stays"` and is not kept as a choice, so everyone who never chose
  gets the new default (unit test).
- Side effect fixed on the way: the idle stick hint (the "MOVE" ring) sat **on the player** at a side room's start
  (it only dodged the player in town). It now moves off the player in fights too (`playerRect` knows the Dungeon's
  player): at Catford High Street's start it sits above him instead of over him.

## B. JUMP: "jumping feels a little awkward"

Played Catford High Street (the SanMikverse side room) by touch at 844x390 with the iPhone insets and at 740x360:
running, jumping pits and platforms, double jumps, jumping while running with auto-fire, turning round. What I found,
measured, and what changed:

| Suspect | Finding | Change |
|---|---|---|
| **The hold-for-height window** | **The main cause.** The side rooms' standard platforms sit 135 px above the floor, exactly one full jump (measured full jump: 135 to 140 px rise). Stage 2's variable height cut a tap to a 78 px hop (smoke measured 75) and a press had to last about 200 ms before a jump reached those platforms (a 120 ms press gave 98 px). So the same quick thumb tap that works on every phone platformer fell short, and whether a jump landed depended on a few ms of thumb. On top of that the one-way platforms' 20 px "landing tolerance" never worked: Arcade only lands a body that enters a top within its 4 px bias in one physics step, so a jump that topped out 5 to 20 px short fell back through. | `JUMP_TUNE`: cut no earlier than 100 ms after take-off (was 80), to 450 px/s (was 300; air jump 390, was 260). The quickest tap now climbs **126 px by formula, 122 to 123 measured in game** (before 78 / 75); held 140 ms or more is the full jump, as before. And `ledgePop`: a jump whose top ends up to 20 px under a one-way platform's top (jumped into from below) is put on it. Measured: a quick tap (press and release in one frame) under the first standard platform **lands on it** (rests at y 357, its top; before: back on the floor). Smoke checks both. |
| **Camera jolts** | Turning round, the look-ahead flipped from 35% to 65% with an exponential ease (time constant 133 ms) and the running trail's sign flipped at once: the view moved up to **135 game px in 60 ms** right after a turn, a whip each time you turned round. | The follow offset now changes at most 0.45 game px a ms (`CAM_OFFSET_RATE`; `LookAhead.turnMs` 700). Measured: the offset's fastest change on a turn **0.48 to 0.52 px/ms** (cap 0.45 plus timer jitter; it was over 2), the camera's largest move in 30 ms **31 game px** including the player's own running (before 135 in 60 ms). Player still at 35% / 65% once settled (unit test at 30 to 144 Hz unchanged). |
| Thumb travel JUMP ↔ FIRE | 96 px centre to centre, 24 px between the drawings, their touch areas meet (gap routing). | Unchanged: auto-fire is on by default in side rooms, so FIRE is a manual override, not something the jumping thumb needs to reach. Moving FIRE closer would cramp DODGE above it. |
| JUMP near the edge / home bar | JUMP's drawing ends at y 359 at 844x390, 10 px above the 21 px home-indicator strip; its touch area runs to the right edge and down to the strip. | Fine, unchanged. |
| Stick-up jumping | The side-room stick is left / right only, so pushing up does not jump (research: up-jumps misfire). JUMP is labelled for the first rooms. | Unchanged (research M6). |
| Input latency | JUMP acts on touch-down; the player is rising while the thumb is still down (smoke: 80 px up during a 160 ms press). | Fine, unchanged. |
| The pit under JUMP going see-through | Polish N5 already keeps a solid green outline and the icon. | Fine, unchanged. |
| The idle stick over the player at the room's start | It sat on the player. | Fixed (see A). |

The Controls picture's JUMP line now reads "Tap to jump, hold it for the highest jump, tap again in the air to double
jump" (UI help, not dialogue).

Deviation from the research ("Jumping (detailed)" asked for a ~78 px tap hop): deliberately dropped. In this game the
laptop never had variable height (every jump is full), and the platforms are built at exactly one full jump, so a small
hop only ever made a phone player miss. A tap is now nearly a full jump; holding still adds the last bit.

## C. SPECIALS: "The specials, when they do activate, are tiny to press"

On the live site this was the old canvas pad. In stage 2 SPECIAL, READY (WONK! / GOLD / CUME / IBS!), HEAL and the
Kreltality prompt were already big (60 / 60 / 56 / 84+ px), but the fart, fizzy bongo, SanMik and juice were 32 px
tall chips under the health bars at the top left, far from the right thumb.

Now (`combat.ts`, `combatLogic.ts`, `combatCss.ts`, `layout.ts`): **the pocket**: 💨 (with its level: FAIRY / BEANS /
CABBAGE), 🍺 BONGO (with the count) and SANMIK are full-size round buttons, each in its own fixed slot at the cluster's
upper left (`pocketFart` in 206 / up 186, `pocketBongo` in 206 / up 266, `pocketSanmik` in 286 / up 226), mirrored for
left-handed play, part of the cluster's shared touch surface. The calm-screen rule stays: each shows only while it can
be used, and pops in. The juice chip is gone: **HEAL** is the juice's one button, up whenever a drink would heal, and red
(pulsing the first times) under 40%.

Measured (play script, iPhone 844x390 with insets, mid-game kit): 💨 and 🍺 drawn **60 x 60**, touch **100 x 100**,
centres (591, 183) and (591, 103); HEAL 56, 96 x 96; at 740x360 55 px drawn. Before: 💨 98 x 32, 🍺 56 x 32, at the top left
(x 120 to 300). Tapping 🍺 drinks a bongo (2 → 1), tapping 💨 releases the fart (meter 55 → 0). No two button faces overlap
(measured at 844x390 and 740x360; the smoke `polish` section checks 750x340 and 932x430 too, and that 💨, 🍺 and HEAL are on
the right half, 60 px at 844x390, at least 52 elsewhere, 44+ px to touch).

Touch wording updated with them (phone-only swaps of the tutorial / system lines that already had phone wording; no
dialogue): "💨 at the top left." → "💨 pops up on the right once it's charged."; "🍼 at the top left, and HEAL pops up when
you're hurt." → "HEAL pops up on the right when you're hurt."; "🍺 at the top left." → "🍺 pops up on the right when you
have one."; "Tap 💨 (top left) to unleash it." → "Tap IBS! (on the right) to unleash it." The Controls picture gained one
line for the pocket.

## D. PAUSE: "Is there a pause button?"

Yes, in every phone mode that pauses on a laptop. It is the layer's II, top right (52 px drawn, 72 x 68 px touch, clear
of the Dynamic Island and the weapon chip):
- walking: Home, Hub, Club, Kreddle (and its raid and rout), the Venue;
- top-down rooms and boss rooms, side rooms (also while the WONK mash overlay is up);
- the finale brawl: its own II (same slot), which opens the carry-on card with SKIP FIGHT.
Measured this round: shown in a side room and a top-down room (play script), and by the smoke's combat, side, brawl and
town checks. Not shown while a conversation, a scripted moment or the weapon picker is up (nothing pauses there on a
laptop either), on menus (they are the pause), or in the overlay minigames: none of those has a pause on a laptop
(Whack's and RuneScape's Esc leave the game); that is stage 3's. **No mode lacked one, so none was added.** On the live
site (stage 1) the fights used the old canvas pad, which is where the user missed it.

## Dialogue

No dialogue or story text was changed, added or removed. The only swapped lines are the four phone touch-wording lines
above (tutorial rows and one system hint, already phone-swapped since stage 2; laptop lines unchanged). No character
line mentioning a key was touched.

## Checks (dev servers from this worktree: normal 5222, ALT 5232; logs in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/work/s2-feel/`)

| Check | Result |
|---|---|
| (a) fingerprint `shell,front,newgame,hub,meeting,dungeon` (main + ALT) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** (`fp1.log`) |
| (a) fingerprint `boss,side,places,minigames,finale,alt` | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** (`fp2.log`) |
| (b) touchlaptop / ipad / fire7 (`front,newgame`) | all **OK** |
| (b) androidtab (`front,newgame,hub`) | **OK** |
| (c) `tests/desktopInvariants.test.ts` | 19/19; `git diff 37a710d4` on it, `tests/fingerprints/`, `index.html`, `src/main.ts` is empty |
| (d) `npx tsc --noEmit` / `npx vitest run` | clean / 44 files, 553 of 553 |
| (e) `mobile-smoke.cjs` normal (5222) | SMOKE_NORMAL |
| (e) `mobile-smoke.cjs` ALT (5232) | SMOKE_ALT |

New or changed checks: unit tests for the stick setting (old value mapping, three choices), `keepInZone`, `healShown`,
the jump numbers at 10 / 30 / 60 / 120 Hz, the one-way ledge pop, the camera's turn rate; smoke: the stick's base stays
put / FOLLOWS stops at the zone edge, HEAL at 90% health, the pocket sizes and side at four phone sizes, a quick tap
lands on a standard platform, a turn moves the camera smoothly.

## Screenshots (1x)

`/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-feel/`: `after-844x390-*` and
`after-740x360-*`: `side-start` (idle stick off the player), `side-stick-far` (the base where the thumb landed, the thumb
far away), `room-pocket` (💨, 🍺 and HEAL full size on the right), `settings-stick` (STAYS / FOLLOWS / FIXED);
`side-844x390-start.png` is the stage 2 side room before this round.

## Honest verdict and what is still not great

- A first-time player now gets a stick that stays put, jumps that land where they look like they should, specials that
  are thumb-sized and where the thumb is, and a pause button in every fight. That covers all four complaints.
- With the stick staying put, reversing direction in a side room after pushing far past the rim needs a longer thumb
  move than the following stick did. FOLLOWS is one tap away in Settings for anyone who prefers it.
- The pocket sits about 200 px from the resting thumb (the cluster's upper left): reachable, but a stretch on the
  smallest phones; worth a look on a real phone in stage 4. The game's own 1.7 s weapon card after a swap can sit under
  🍺 for a moment.
- The smoke's coyote check was sensitive to test order once (it ran after a check that left the player on a platform);
  moved, then passed twice in a row. Not a game change.
- Everything here is Playwright emulation; nothing was tried on a real phone.

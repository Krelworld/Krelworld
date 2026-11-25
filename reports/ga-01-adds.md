# ga-01: game additions (all versions)

Branch `game-adds` (worktree scratchpad/game-adds-wt), from 496f1066. Requests 1 and 3 of the user's three
(request 2, the auto-fire audit, is phone-only and belongs to another role; nothing of it here).

## 1. Mikey's collect quest: taken out (411037a7)

- arc_mikey ("The Modulator") lost its step `lost_property` (collect: passport, wallet, licence, two bike
  batteries, headphone case). The story is now pizza_trial (laptop at home) -> russian_hackers (pub payphone) ->
  sugar_parcel -> election -> modulate -> nuclear. The laptop scene's lines about losing everything stay word for word.
- The step's own pickup line, MIKEY "YEEEE. Wot majik. Am a wizard.", went with the step (it only played on picking
  up those items). No other line anywhere changed.
- Nothing else referred to the step: grep for `lost_property`, the item names, "Your stuff" over src, tests,
  scripts, fingerprints: none. Map markers, glowing pickups and the quest log are generic over open collect steps;
  DebugSkip and the TV log have no per-step entries for it.
- Old saves: progress is a flag per step id, so a save sitting on the hunt (some `arcspot_arc_mikey_lost_property_*`
  flags set) is simply on russian_hackers; the leftover flags are ignored.
- The chapter's dungeon gate (requiredArcSteps) clears when the story is done.
- Tests (tests/arcs.test.ts): the new step order and no collect step; an old save with two items picked up is at
  the payphone (PUB) and nothing of Mikey's is at FIELD; finishing every step empties the required list and pays out.
  The old "collect steps finish" test picked "Mikey's first quest with a collect step"; it now names Boggor's photos.

## 2. The bike (laptop, phone, tablets; main and ALT)

What the player gets:
- A red pixel-art bike (with a basket and a bell) stands on the grass right of Home's front door, from the start of
  a new game and in every old save. Walk up: the prompt says "E: Ride your bike" (phone: ACTION says RIDE).
- Out in town, **Z** gets on or off anywhere (rebindable, in the Controls page); on a gamepad **L3** (click the left
  stick, like a sprint); on a phone the **RIDE / WALK** button; on a tablet's old pad a 🚲 button in town.
- Riding is 1.8x walking (378 px/s in town, 414 on the Kreddle Strip), with a little pick-up (220 ms), a coast when
  you let go (260 ms) and quick brakes when you turn round (110 ms). Same body and colliders as walking (never
  through walls, water, buildings; NPCs never blocked walking either). Camera: the game's own follow + lead, unchanged.
- Your lad pedals: his own walk cycle, one frame per 26 px of road (so the legs slow as you coast; idle pose under
  40 px/s), on a bike drawn round him in all four directions (side view mirrored for west, spokes and pedals turning;
  head-on and from behind the wheel, bars and lamp / reflector in front of him). His shadow stretches under the bike.
  A bell when you get on, the freewheel ticking when you get off (both made in Synth, no file).
- Getting off: Z / WALK, or automatically when you use anything (E on a door, a chat, a shop, the telly, the bike's
  own prompt is only there on foot), when a story conversation or scene pauses the town (the pause menu does not),
  in a cutscene, the shoving match, a beat-up, or when the avatar is hidden. The bike is left standing beside you;
  once you are 720 px away it is back outside Home. Going indoors (any other scene) is always on foot.
- The Kreddle Strip (an outdoor walking area over the bridge): Z gets on anywhere there too, same rules; a machine,
  a chat, a shove or any pause gets you off; a bike left there just goes.
- Never in Home, the Club, the Venue, the pub, dungeons, minigames, cutscenes (BIKE_SCENES = Hub, Kreddle only).
- Saves: riding is never saved (you load on foot). The one new flag is `bike_tip` (the tip has shown).
- First time near the bike (or the first ride): one system toast, "YOUR BIKE: Press Z to hop on your bike, anywhere
  in town. Z again to get off." (the key's current binding). On phones it reads "Tap RIDE (the bike button) to hop on
  your bike, anywhere in town. Tap WALK to get off." (TOUCH_WORDING rows `bike-on`, `bike-off`).

Phone (src/game/mobile/bike.ts, bikeLogic.ts): one control in walk mode, slot `walkBike` (60 px, in 148 / up 44:
left of ACTION on the thumb's resting line, mirrored for left-handed), a drawn bike with RIDE under it, WALK and lit
red while riding; shown only while the scene reports a bike to get on or off (systems/bike.ts `BIKE`, stale after
250 ms), pops in, pulses until first pressed (cue "bike"). The stick steers the bike. The Controls picture's WALKING
tab has a RIDE line. Judged against 00-USER-PRIORITIES: one big labelled button that appears only out in town, where
the thumb already is, saying what a tap does; a first-time player gets it from the button and the one-line tip.

Design choices (defaults kept unless said):
- Key Z: free in every scene (B is the fizzy bongo; H is used by one minigame; Z sits next to WASD for the left hand).
- Gamepad: all 16 standard buttons already have a job, so the bike is a fixed row "L3 (click the stick)" in
  PAD_FIXED (L3's default job, the golden transformation, only works in fights). It steps aside if the player binds
  L3 to anything that works in town (interact, attack, SanMik, dodge, special). No existing pad default changed.
- The art is drawn in code (scratch art/bike.py, PIL, no anti-aliasing, 64 px frames like the lads' sheets): the
  PixelLab tools were not available in this session. The rider is a composite on his own sheet (walk cycle as
  pedalling); see the screenshots.
- Kreddle included (it is an outdoor walking realm), no parked bike there.

Files outside src/game/mobile (the bike is ordinary game code, hard rule 0): systems/bike.ts (new), gfx/Bike.ts (new),
public/art/props/bike.png + one manifest entry, HubScene (make / ride / get off, the shadow, the prompt),
KreddleScene (ride / get off), combat/Controls.ts (`bike()`), systems/keybinds.ts (Z), systems/padbinds.ts (L3 row),
scenes/MenuScene.ts (Controls rows 21 px apart instead of 22 so the 17th fits), ui/TouchControls.ts + UIScene
(the tablets' 🚲), audio/Synth.ts (two sounds).

Screenshots (scratchpad/mobile/shots/game-adds/):
- riders-all-1x.png / riders-all-2x.png: all nine lads and SanMik, south / east / north / west, mid-pedal (the
  same layering the game draws: bike behind, lad, bike in front).
- laptop-home-*.png / home-crop-2x.png: the bike outside Home (before: the same spot was empty grass, see the
  `hub` fingerprint diff below). laptop-dir-*-FLENKY.png: riding in town, each direction. laptop-riding-*.png.
- bike-riding.png: the phone (844x390) riding, the WALK button lit.

Measured (fake clock, laptop): walk 212 px/s, ride 375 px/s (1.77x; body velocity 378 = 1.8x), coast after
150 ms 204 px/s; Kreddle 413 px/s. Phone (real touch, iPhone 14 profile): walk 210, ride 378, 1143 px across town in
2.5 s. Performance: three extra sprites (two hidden when not riding) and no per-frame allocation beyond the
game's own; no measurable cost.

Tests: tests/bike.test.ts (speed, pick-up / coast / brake, diagonal top speed, scenes, every get-off reason, the
phone button's show rule and face, the key and pad rules, the tip on laptop and phone); smoke section `bike`
(scripts/mobile-smoke.cjs: the button up in town and not indoors, a tap gets on, the tip in touch words, the stick
rides across town faster, WALK gets off, ENTER at a door gets off and through it); laptop script
scratchpad/mobile/work/game-adds/laptop.cjs (fake clock: parked at Home, the prompt and tip, E gets on, Z off,
speed, coast, the four directions, a door gets you off, the Kreddle Strip) passed on main (FLENKY, MIKEY) and ALT
(KREBLIS). On ALT it first found a real bug (the Krezz Arms door opens a conversation there, which paused the town
with the rider still on): fixed in 53a8e2ad.

## Dialogue

- No dialogue or story line added or reworded. One removed with its quest (above).
- Swapped on phones only: the bike's tip toast (system text, new) and the town prompt "E: Ride your bike" ->
  "Tap: Ride your bike" (the existing prompt rule).
- Character lines that mention a key: none added or touched by this work.

## Checks

(filled in below)

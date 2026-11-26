# dn-01: the Job Centre toilet (branch "donut", from game-adds 4b8355bd)

## In plain English

- **No more "clear the Job Centre first".** In chapter 5's Job Centre Plus room you can open the STAFF TOILET at
  any time, mid-fight included. The two lines of the refusal ("ENGAGED. From inside: a soft, rhythmic creaking..."
  and SanChz's "(muffled) Busy. Mork. Clear the Job Centre first.") are gone; that was the gate.
- **It is safe mid-fight.** The cutscene runs as an overlay over the paused room (the same mechanism the game's
  Kreltality cue uses, gfx/Overlay.ts): enemies, bullets, crushers, steam, movers and the San Brothers all freeze.
  When you walk back out you get 1.5 s of grace in which nothing can hurt you, crushers included (they are
  "unblockable", so ordinary i-frames would not have covered them).
- **The exit is unchanged in rule:** it opens once the scene has played AND the waves are done, as before. Either
  order works: see the scene first, then finish the fight (the door opens on the last kill); or finish the fight
  first (the exit hint "Where's SanChz? He went to the toilet twenty minutes ago. Check the STAFF TOILET." still
  shows, and is still true), then the door opens when the scene ends. The hint text is untouched.
- **The cutscene (new art).** While the scene's lines play, a full-frame pixel-art picture:
  - the door creaks open on a strip of candlelight;
  - the transformed staff toilet: tealights on the cistern (they flicker), rose petals in the sink and on the floor,
    a little speaker on the shelf with notes drifting off it, slow jams playing (the game's own "mot_rnb" track);
  - SanChz, in his own outfit (gold bucket hat, blue shades, blonde hair, holographic gold tracksuit, gold chain),
    fully clothed, trousers on, holding a pink jam donut to the front of his trousers, swaying in time with a
    creak on every beat; a small pixelated patch over the middle of the donut as the comic touch;
  - the beats follow the lines: he appears on "And there is SanChz...", freezes on his "…", shakes on his rant,
    starts again on "…It's exactly what it looks like.", and on "The donut moans in pleasure" he switches to the
    open-mouthed moaning frame with hearts, a drip of jam, motion lines and a squeaky pitched-up YEGH; SanMik
    bursts in from the left ("!!"); on "YEGHHH. Love shagging jam donuts!!" a big "YEGHHH" pops, more hearts,
    the fastest sway; the building shakes on "Outside, the whole Job Centre shakes..."; he stops on SanMik's
    "Whose donut is that."
  - No genitals anywhere: he is clothed in every frame and the pixelation is a joke over the donut.
- **Sound:** his moans are only his own recorded YEGHs (Synth's "yegh" bank) played slower / faster; the donut's
  moan is one of his YEGHs pitched way up. Slow jam: the existing "mot_rnb" track (the room's music comes back
  after). Creak, splat, squelch: existing effects (drp_creak, drp_splat, sq_squelch). Nothing generated in anyone's
  voice; no ElevenLabs calls were needed.
- **Phones:** the picture fills the 960x540 game frame on the iPhone 14 landscape (with its 47/47/21 insets) and on
  a small 740x360 Android, and SanChz's face and the donut sit above the dialogue box and left of the phone's
  AUTO / LOG / SKIP pills. The phone's touch layer shows no game buttons over the cutscene (the box's own SKIP /
  LOG / AUTO pills work as in every conversation). The laptop and the ALT build get exactly the same scene.

### Screenshots (2x) for the user

Laptop (960x540 at 2x):
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-laptop-reveal.png
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-laptop-moan.png
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-laptop-love.png

Phone (iPhone 14 landscape 844x390 with insets, at 2x):
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-iphone-reveal.png
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-iphone-moan.png
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/donut/donut-iphone-love.png

## What changed (files)

- src/game/scenes/DungeonScene.ts: `useTalker` case "donut" no longer refuses (the two refusal lines removed);
  `donutScene()` plays its 13 lines (identical words, a stage cue `fx` added to 11 of them) through
  `playDonutToilet` with the room busy and paused under it, then the same flag / exit check as before, plus
  `graceUntil` (1.5 s of the fight clock; checked at the top of `damagePlayer`, reset per room; 0 unless this
  scene just played, so nothing else changes).
- src/game/scenes/side/donutToilet.ts (new): the overlay scene "DonutToilet" (added on first use by runOverlay, not
  in main.ts's scene list), its own DialogueBox, the art, the beats, the sound.
- public/art/ss/dn_toilet.png (256x144), dn_chz.png and dn_chz_moan.png (128x160): PixelLab (generate-image-v2
  with his sprite and portrait as references, the game's own still as style; edit-images-v2 for the calm face;
  the pixelation baked in). Loaded on demand the first time the scene plays (not in the art manifest, so no boot
  or fingerprint change anywhere else).
- src/game/mobile/modes.ts: "DonutToilet" joins the "screens and overlays" row (touch mode none).
- src/game/mobile/combat.ts: a combat button held while the mode changes under the thumb (USE on a door that opens
  a cutscene at once) now hides once the thumb lifts; it used to stay on screen over the cutscene. Phones only.
- src/game/mobile/README.md: the scene in the mode table.
- scripts/donut-check.cjs (new): the check below.

## Dialogue (hard rule 3)

- Removed, as the user asked: the two refusal lines ("ENGAGED. From inside: a soft, rhythmic creaking. And… is
  that Marvin Gaye?" and SANCHZ "(muffled) Busy. Mork. Clear the Job Centre first.").
- Every other line of the scene, the repeat visit and the room is word for word as before (git diff shows only
  the added `fx` fields). Swapped narrator tips: none. Character lines that mention a key: none in this scene.
- The "YEGHHH" that pops on screen is a drawn sound effect in the picture, not a line.

## Tests

`node scripts/donut-check.cjs --url <dev server> --profile laptop|iphone|android [--k 2] [--shots dir]`: reaches the
room through DebugSkip, checks it is mid-fight, uses the toilet (E on a laptop, the ACTION button on a phone), the
room is paused under it, the art is loaded, SanChz is on screen with the donut above the box, the moaning frame on
the donut's moan, all 13 lines shown in order word for word, the room comes back with the flag set, a 1.5 s grace
(an unblockable hit does nothing), no damage taken, the exit shut while waves remain and open once they are done,
the repeat visit says "We don't talk about it. YEGHHH." with no cutscene, no page errors; on phones no game
controls over the cutscene. Results: laptop OK, iPhone OK, Android 740x360 OK (also ALT, see below).

## Checks (final code, commit 16fc2bcb)

| check | result |
| --- | --- |
| (a) laptop fingerprint, first half (shell, front, newgame, hub, meeting, dungeon; main + ALT) | DESKTOP FINGERPRINT: OK, 40 of 40 states identical |
| (a) second half (boss, side, places, minigames, finale, alt) | DESKTOP FINGERPRINT: OK, 25 of 25 identical |
| (b) touchlaptop, ipad, fire7 (front, newgame); androidtab (front, newgame, hub) | all four OK |
| (c) desktopInvariants.test.ts | 19 of 19; that file, tests/fingerprints/ and index.html unedited |
| (d) tsc --noEmit | OK |
| (d) vitest run | 567 of 567 (one earlier run had 1 failure that did not repeat in the next two runs: a timing test under load) |
| donut-check.cjs | main: laptop OK, iPhone OK, Android 740x360 OK; ALT: laptop OK, iPhone OK |
| (e) phone smoke, main, full | 436 ok, 5 failing: SWAP tap, slide-to-pick, coyote, camera turn, P2. Re-ran `combat`: 46 ok, SWAP tap failed again (slide-to-pick passed) |
| (e) phone smoke, ALT | the machine was at load 30-78 (other agents); the full run's browser was killed / crashed twice. In sections: phone, upright, settings, read, dialogue, settings2, guide, optout, town, bike, dungeon, combat, side (part), brawl, together, review1, polish, android and desktop ran; failures: weapon chip tap, coyote, quick-tap height, P2, and `lists` / `wording` "Target crashed" (the renderer dying at the same spot each time, three times) |

No laptop baseline was re-recorded: the fingerprint states do not include this room, and the feature only adds code
that runs when the toilet is used (the grace check is a comparison with 0 otherwise; the art is loaded on demand).

About the smoke failures: SWAP tap, slide-to-pick, weapon chip tap, coyote, quick-tap height, camera turn and P2 are
the timing failures earlier reports list under load (s3-02, s3-06, s3-07, ga-01, ga-02: "SWAP tap ... pistol ->
pistol under load", "P2 fails on the baseline too"). The ALT `lists` / `wording` renderer crash is in the base
branch's own final ALT smoke too (work/game-adds/final-smoke-alt.log, same "lists: Target crashed"); ga-08 records
it as out-of-memory that passed on a rerun on a quieter machine. On main, `lists` and `wording` pass.
My one change in phone combat code (combat.ts `leave()`) only runs when the combat mode is left while a button is
held (the WeaponPick picker, a cutscene, a conversation) and only hides a control after its thumb has lifted, so it
cannot change which gun a 90 ms SWAP tap picks (that tap does not leave the mode). A reviewer with a quieter machine
should re-run `--only combat,side` (main) and `--only lists,wording,side` (ALT) once.

## Notes

- PixelLab: 3 generations (backdrop, 4 SanChz candidates, 1 face edit); ElevenLabs: none.
- The scene's beats are keyed to its lines by a stage cue (`fx`) on the line, which the dialogue box passes through
  unchanged; skipping (Tab / SKIP) still fires each cue and the scene ends cleanly.
- If the art failed to load, the scene still plays (a plain dark room, the lines as before).

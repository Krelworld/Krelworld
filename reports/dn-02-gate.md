# dn-02 gate: Job Centre toilet (branch donut, head 16fc2bcb)

Reviewed commits 28e402e8, cfc1556d, 16fc2bcb on top of game-adds 4b8355bd. Worktree read-only; dev servers 5683 / 5693.

## Verdict
PASS for the feature (see the smoke section for the phone smoke result).

## What I checked
- **Dialogue.** Script-compared every say/dir/gabor string in the DungeonScene diff: the only strings removed are the two
  refusal lines ("ENGAGED. From inside: ..." and "(muffled) Busy. Mork. Clear the Job Centre first."); nothing added or
  reworded. The other 13 lines are identical; only an `fx` cue was attached. Room data (exitHint, label, enterLines) is
  untouched. No narrator tip swapped; no character line mentions a key.
- **No new voice.** No audio files in the diff. Moans are `synth.shout("yegh", ...)` (the existing recorded YEGH bank) at
  different rates; music is the existing `mot_rnb`; sfx are existing (drp_creak, drp_splat, sq_squelch, door, subDrop).
- **Art.** Looked at the reveal, moan and love frames on laptop and iPhone. SanChz matches his in-game look (gold bucket
  hat, blue shades, blond hair, rainbow-yellow tracksuit, chain), fully clothed, donut held at his groin, a small
  pixelated patch on the donut, nothing explicit. Moaning frame (open mouth, blush), hearts, motion lines, jam drip and
  the "YEGHHH" pop make what is happening clear. SanMik bursts in on his line.
- **Mid-fight, laptop main** (builder's donut-check, re-run by me): toilet opens with E while 9 enemies are up; room
  paused; 13 lines word for word in order; flag set; 1.5 s grace (blocks even an unblockable hit); exit shut while waves
  remain, opens once they are done; repeat visit plays "We don't talk about it. YEGHHH." with no cutscene. OK.
- **Own probe** (rev.cjs, real HP, not the 9999 the builder's check uses, an enemy placed on the player):
  - laptop main, waves cleared FIRST then the toilet, Tab skip after the love line: no damage, YEGHHH pops, every cue
    fired (also when skipped), room music restored ("sanmik"), exit opens straight after the scene, player moves. OK.
  - iPhone 14 landscape main (insets 47/47/21, real CDP touch), mid-fight, opened with the ACTION button, SKIP pill then
    SKIP SCENE: no damage, all cues, music restored, exit still shut, combat controls back (mode side), dialogue pills
    gone, the stick walks the player. OK.
- **ALT**: donut-check laptop OK, iphone OK.
- Code: runOverlay pauses the room (enemies/projectiles/crushers frozen); busy flag and controls.swallow() stop the
  advancing key leaking into a jump/fire; graceUntil reset per room; timerEnd extended by the scene's length.
  combat.ts sweep only runs on phones (mobile chunk) and stops once combat is active again.

## Laptop / devices / tests / builds
- Fingerprint half 1: 40 of 40 identical, DESKTOP FINGERPRINT: OK. Half 2: 25 of 25 identical, OK. No baseline
  re-recorded (the cutscene is not in any recorded state), so laptop differs only by this feature.
- touchlaptop, ipad, fire7 (front,newgame) and androidtab (front,newgame,hub): all OK.
- desktopInvariants 19/19 (in a 32/32 targeted run); tests/, tests/fingerprints/ and index.html unedited by the branch.
- tsc clean. Full vitest under load: 565/567, the 2 failures were 5 s timeouts (content.test "no slurs", wonkStyles)
  while a fingerprint browser ran; both files pass alone (with --testTimeout 60000). Not related to this change.
- Production builds main and ALT succeed (dn_*.png present in dist); temp folders deleted.

## Non-blocking notes
1. When the player is MIKEY (he IS SanMik in the SanMikverse), the line variant deliberately drops "(bursting in)",
   but `burst()` still bangs the door, shows "!!" and slides SanMik in. Cosmetic; could skip the bang / "!!" when
   `G.s.player === "MIKEY"`.
2. The backdrop's generated sign text is garbled ("STAFF TOLET -PLEASE KEEF CLEAN"). It reads as a joke sign but is
   AI-art lettering, not dialogue.
3. Skipping fires all remaining cues at once (several moans/creaks overlap for a moment before the fade). Acceptable.
4. Eyes are behind his shades (as the builder says); the open mouth and blush carry the moan.

## Phone smoke
SMOKE_RESULT_PLACEHOLDER

# Stage 2 merge: mobile-ui into mobile (MERGER)

Worktree /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt, branch `mobile`. Two runs (the first was cut off by a usage
limit after the merge and the wording commits; this run did the checks, fixes and verification).

## Commits (e8cf3f4f..HEAD, mine)

| Commit | For the player |
|---|---|
| fac0d1ef | Merge `mobile-ui` (a real merge commit, no rebase). Conflicts in index.ts, layout.ts, settings.ts, touchLayer.ts, README.md and mobile-smoke.cjs, all resolved keeping both: the pause menu has PHONE SETTINGS and CONTROLS, the settings list keeps all 13 rows (+ Phone layout) with the combat rows `live: true`, README and smoke keep every section |
| 90e57eb8 | Fights' narrated control tips and toasts name the phone's buttons (one shared table: combatWording rows are added to wording.ts's TOUCH_WORDING / NARRATOR_TIPS); settings page shows how a controller hands over (PAD_NOTE) |
| ef0afd1d | README for the above |
| efb2860e | Smoke test: new `together` section (see below) |
| dcd9c75e | Finale brawl: its how-to legend moves up under the two health bars on a phone. With bigger text on it had grown to two lines and ran under PUNCH and BLOCK |
| 1c033a2e | Fight HUD: KREZZ / WONK beside the bars now end above the drink / SanMik chips at any text size (they ran under the SANMIK chip, badly with Text size LARGE); the boss bar starts right of them |
| 05cb793a | README rows for the two fixes |

The coordinator's 0d681a8f (live game merge, Elon fight removed, Chef Marina) and 9770d543 (Add to Home Screen guide) are kept.

## Where the two tracks meet: what I checked and what I changed

- **Readability ON (default) in fights.** Checked the combat HUD texts, the weapon chip, READY (WONK!), the picker, the
  DOM button words, the Controls picture (all 4 tabs), the brawl and a boss fight, at text size NORMAL and LARGE.
  Found and fixed (phone only):
  1. KREZZ / WONK % lines (two lines, raised by the floor) overlapped the SANMIK / fart chips under the bars.
     `UIScene.phoneMetersY()` (inside the existing `phone` branch) puts their bottom at y 59, above the chips at 61.
     The boss bar's x is now `max(372, KREZZ/WONK right + 8)` (it was overlapping by a few px before; combat track gap).
  2. The SSJ brawl legend wrapped to two lines under PUNCH / BLOCK. `brawl.ts fitLegend()` moves it to y 74 under the
     bars, wrap 820 (phone-only module code; the game file is untouched).
  Not changed: the weapon picker with very many guns (20 in a debug kit) covers its own "CHOOSE YOUR WEAPON" title and
  how-to line with the third row of cards. That is the game's own grid (same on a laptop), not a merge effect; a
  normal kit has far fewer guns. The Controls picture's dot labels are 9 CSS px inside the miniature (the legend
  beside it is 13 px and carries the words); left as a picture.
- **Combat HUD prompts use the sweep's wording table.** Yes: combat.ts adds COMBAT_WORDING / COMBAT_WORDING_FIRST
  to wording.ts's TOUCH_WORDING with `addWording`, and COMBAT_NARRATOR_TIPS to NARRATOR_TIPS, which the dialogue
  box applies to narrator / stage-direction lines only. Seen in play: the Wildern CONTROLS line reads "CONTROLS: drag
  on the left to move · FIRE shoots by itself ..." on the phone.
- **Phone settings page live in a fight.** pause (in a Wildern fight) → PHONE SETTINGS → Auto-fire off and Button
  size L → DONE → RESUME: FIRE is 100.8 px at once (was 84); text size LARGE applies at once; HUD still fits.
- **Pills vs combat layer.** A conversation inside a fight: mode `none`, no `c-*` control shown, SKIP / LOG / AUTO
  up; SKIP ends it, pills gone, combat controls back. (Same rule for any conversation: the Dialogue scene makes the
  layer `none`.)

## Play by touch (iPhone 14 landscape 844x390, insets 47/47/21)

Covered by the smoke sections (all run in this session, see Verification): boot and the Enter gate, character select
(PLAY AS), new game to Home, the welcome conversation, SKIP / LOG / AUTO and Back in conversations, the Hub, the
Phone settings page (title and pause), a top-down room (Wildern) and a boss (Krandall), a side room with jumps
(Catford High Street: buffer, coyote, hop vs full, drop-through), the finale SSJ brawl, the Krezz Arms pub brawl
(new: its line says "Tap to swing", taps anywhere floor the crowd), pause → CONTROLS picture (FIGHTS tab in a
fight, SIDE ROOMS in a side room). Screenshots I looked at: /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-merge/ (fight HUD,
READY, picker, conversation in a fight, settings, large buttons, Controls picture, side room, brawl, large text,
boss).

## The smoke test's new `together` section (scripts/mobile-smoke.cjs, in the default list)

21 checks: readability on; Wildern fight HUD texts on screen and DOM words fit; KREZZ / WONK clear of the chips;
READY with specials full; picker with bigger text; conversation in a fight (pills, no fight buttons, narrated
CONTROLS line in touch words, SKIP back to the fight); PHONE SETTINGS from the fight's pause changes auto-fire and
button size live; text size LARGE in a fight; pause → CONTROLS opens on FIGHTS with fitting words; Krezz Arms brawl
by taps; Krandall boss bar and name clear of KREZZ / WONK at NORMAL and LARGE. The brawl section also gained a check
that its legend is clear of the buttons.

## Dialogue (hard rule 3)

I changed no dialogue or story text. Narrator / system control lines swapped on phones only (laptop lines unchanged),
all through the narrator-only path or hint() tables:
- wording.ts NARRATOR_TIPS (menus track): Home's "TIP: WASD / arrows (or the stick) to walk. E to use things.";
  "walk up (to it) and press E"; "and press E to"; Kreddle "talk to the locals (E)"; Krebon's "Tap / SPACE";
  Mikey's SanMik tip ("Press V (or the SANMIK button)", "Press it again to go back to being you"); the raid's
  "(mouse / J / the fire button)".
- combatWording.ts COMBAT_NARRATOR_TIPS (90e57eb8): Wildern "CONTROLS: WASD move ..." (data/dungeons.ts), the
  first side room's "SIDE-ON CONTROLS: ..." (control sentences only), the Citadel's "RUN AND GUN: ..." and "CLIMB:
  ..." legends (content/citadel.ts), Alistair "get close and press F to HEADBUTT." and "only goes down to a headbutt
  (F)." (bosses.ts, ClubScene), the Jam Queen "JUMP over her (W / up).", the Cronster "(walk up, press E)" and its
  mash line, the golden juice how-to "press T (or ⚡T) ... C (or CUME) ..." and "Press T in your next dungeon."
  (systems/squeeze.ts).
- Fight toasts (UI, not dialogue): crate / WONK FULL / IBS / shield / hostage / headbutt toasts.
Character lines that mention a key: none in the fights (both combat reports); the menus track's lists are in
s2-03 (section "Character lines that mention keys") and s2-04 (same heading); all left exactly as written.

## Verification (this run, HEAD 05cb793a)

- (a) desktop fingerprint both halves: `DESKTOP FINGERPRINT: OK` (40/40 and 25/25 states identical).
- (b) touchlaptop, ipad, fire7 (front,newgame: 16/16 each) and androidtab (front,newgame,hub: 29/29): all OK.
- (c) tests/desktopInvariants.test.ts 19/19 pass; that file, tests/fingerprints/ and index.html unedited (no diff
  from e8cf3f4f).
- (d) `npx tsc --noEmit` clean; `npx vitest run` 523/523.
- (e) phone smoke: see the result lines at the end of this file.

## Gaps / not done

- Nothing tried on a real phone (Playwright emulation only), as for both tracks.
- The tracks' own open gaps stand (see s2-01..s2-04): thumb reach READY / JUMP on the smallest phone, auto-fire and
  scarce ammo, the Kreddle raid / rout canvas FIRE, tower rooms not played end to end, the TV picture size (stage 3).
- Weapon picker with more than 14 guns covers its own title (game layout, laptop too).

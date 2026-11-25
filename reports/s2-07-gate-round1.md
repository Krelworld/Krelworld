# Stage 2, final gate round 1

Branch `mobile`, worktree `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt`, head
**06d2ac08**. Everything below was run by this gate on this head; no report was taken on trust.

## Verdict: PASS

- The laptop, and every device next to a phone, is provably unchanged (all fingerprints identical, laptop play the same as
  the base source, the production laptop boot never fetches the phone chunk).
- A phone player can boot, read, fight, jump and get around by touch on an iPhone 14 (with its insets) and a small Android,
  in both builds, with no blocker. Both phone smoke runs pass 370 of 370.
- There are seven non-blocking findings (N1 to N7). The ones a player notices most are the fight-button captions printed
  on top of each other (N1) and long room names running over the HUD's player name (N2). They are listed for the next
  round and are not reasons to hold the release.

State left behind: all dev and preview servers stopped. The production builds, the base source copy, its Vite cache and
the fingerprint scratch folders are deleted. The worktree is clean (no status, no stash) at 06d2ac08. Nothing was pushed.
The main checkout was not touched (clean, still `d071280b`, branch `claude/krelworld-game`). 30 screenshots are kept in
`/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-gate1/`. Scripts and logs are
in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/work/s2-gate1/`.

## 1. Laptop and the devices next to a phone

| Check | Result |
|---|---|
| (a) fingerprint, first half (`shell,front,newgame,hub,meeting,dungeon`, main 5207 + ALT 5217) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** |
| (a) fingerprint, second half (`boss,side,places,minigames,finale,alt`) | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** |
| (b) touchlaptop / ipad / fire7 (`front,newgame`) | 16/16, 16/16, 16/16, all **OK** |
| (b) androidtab (`front,newgame,hub`) | 29/29 **OK** |
| (c) `npx vitest run tests/desktopInvariants.test.ts` | 19/19 pass |
| (c) `tests/desktopInvariants.test.ts`, `tests/fingerprints/`, `index.html` unedited | `git log e8cf3f4f..HEAD` on those paths is empty, and so is `git diff --stat`. `src/main.ts` and `vite.config.ts` are unchanged too |
| (d) `npx tsc --noEmit` | clean |
| (d) `npx vitest run` | 44 files, 547/547 pass |
| (e) `mobile-smoke.cjs` normal (5207) | **370 of 370**, MOBILE SMOKE: OK (1128 s) |
| (e) `mobile-smoke.cjs` ALT (5217) | **370 of 370**, MOBILE SMOKE: OK (1108 s) |
| Is the fingerprint able to fail? | Head in phone mode (iPhone profile, no `?mobile=0`) checked against the base's opt-out baseline: **DIFFERENT**, 0 of 3 identical. The check is not vacuous |

### Diff of every file outside `src/game/mobile/` since e8cf3f4f

`e8cf3f4f..HEAD` also contains the live game, merged in at 0d681a8f (Chef Marina under `public/chef-marina/`, the Elon
fight removed in `src/content/citadel.ts`, `src/content/jukebox.ts`, `src/data/dungeons.ts`, `src/game/scenes/citadel/Citadel.ts`).
Those changes came from the live site and none of them is phone work. To isolate the phone branch's own changes I read
`git diff 27107ea1 HEAD` (27107ea1 is the live tip that was merged, and it contains e8cf3f4f). Outside `src/game/mobile/`,
that diff touches the following files:

- **Game code (11 files), every changed line a guarded hook or an import of `mobile/flag` / `mobile/boot`:**
  `combat/Controls.ts` (aim and aimPoint inside `if (isMobile())`), `combat/HeroPassengers.ts` and `combat/Kreltality.ts`
  (`isMobile() ? phone label : laptop label`, unchanged on a laptop; `closePhone` is null unless `isMobile()`),
  `combat/Player.ts` (a new `else if (side && isMobile() && ...)` branch in front of the old side branch),
  `combat/Wonk.ts` (`isMobile() ? 548 : 480`), `scenes/DungeonScene.ts` (ledge tolerance `isMobile() ? hook ?? 14 : 14`,
  `combatStep` under `isMobile()`, and `leadCamera` skipped only when `isMobile() && side && !busy`),
  `scenes/MenuScene.ts` (the CONTROLS picture and the auto-aim row, both under `isMobile()`), `scenes/PubScene.ts` (card
  step `isMobile() ? ... : CARD_STEP`, so on a laptop `cardH` = `CARD_H`), `scenes/finale/SsjBrawl.ts`
  (`!(isMobile() && hook)`), `scenes/side/SideLevel.ts` (hazard scale and pit respawn `isMobile() ? ... : 1 / lastSafeX`),
  and `scenes/UIScene.ts` (`setupTouch` now returns early on every phone and is unchanged off a phone; every other line
  is gated by `phoneFight()`, which needs `isMobile()`, or by `isMobile()` itself). I checked the boss-bar geometry by
  hand: the laptop's `bb = {x:180,y:506,w:600,ny:494}` reproduces every old constant (182/508/596, the marks
  `181+598m-1`, 504, and the shield badge at `480-w/2-14`, 493).
- **`boot.ts`** (in the laptop bundle) only gains an interface, `let hooks = null`, a setter and `phoneHooks()`, which
  returns `isMobile() ? hooks : null`. Nothing runs at load.
- **Tooling:** `scripts/mobile-smoke.cjs` and `tests/mobile*.test.ts`.

### Laptop played for three minutes, keyboard and mouse, head against the base source

The same script (`laptop-play.cjs`) ran against head (5207) and the base source e8cf3f4f (`git archive`, port 5227, own
Vite cache). It covers the Enter gate, the title, NEW GAME and character select by mouse, difficulty, banter, Home (the
welcome conversation read with Space and E, then Tab), WASD walking, pause, the Hub (walk, pause), the Kreddle Exchange
shop, a cutscene conversation with a choice clicked by mouse, a Wildern room (40 s of mouse aim, held fire, WASD and
dodge, then pause), and Catford High Street as a side room (W jump, double jump, run with D while firing, pause).

- Both builds behave the same. The static screens are pixel-identical (character select, Home conversation, Home pause,
  the cutscene and its choice). The other screens differ only in animation (the title's floating words, the pulsing BUY)
  or in where a real-time fight happened to go. Comparisons: `lap-head-*` and `lap-base-*`.
- Side room, head: jump 80 px while W is held, double jump to 213 px, run 512 px. Base: the same jump, 221 px, 541 px.
- After play on head: `isMobile()` is false; `<html>` has no class; there is no phone element and no `__krelMobile`;
  localStorage holds only `krel_alive, krel_crumb, krelworld.meta, krelworld.save, krelworld.slots.v1` (the same as the
  base); `UI.touch` is null; the only phone modules fetched are `boot.ts` and `flag.ts`.
- Page errors: none on either. Both log the same pre-existing caught `TypeError ... Kit.breakSma...` (head 5, base 4,
  with the same stack).
- One head run walked out of the Wildern room through its door, and one died where the base also died. These are random
  fights. A head run had a script race in the side-room entry (a Dialogue paused the Dungeon while the script waited
  without pressing anything). That was my script's fault, not the game's: the first head run did the side room fine.

## 2. Production builds

- `npx vite build --outDir <tmp>` and the same with `VITE_KREL_ALT=1` both succeed (14.5 s and 15.0 s). The output was
  deleted after the checks.
- Production laptop boot (vite preview, 1280x720, Enter pressed, title reached): the browser fetches only
  `index-BtpdzvRL.js` (main) and `index-Bw1INVIy.js` (ALT). The phone chunk (`index-CBvOHff_.js` / `index-C6mkDw6s.js`,
  241 KB) is **not requested**. `<html>` has no class, there is no `__krelMobile` and no errors.
- Production iPhone boot fetches the phone chunk; `html.mobile`, the layer and no errors.

## 3. Phone by touch (real CDP touch events)

Profiles: iPhone 14 landscape 844x390 at dsf 3, with the CDP safe-area insets 47/47/21 (left/right/bottom); and a small
Android 740x360 at dsf 2. Script: `phone-play.cjs` with sections boot, fight, side, brawl. Every control was pressed by
touch. Debug jumps were used only to reach the place (the Hub, the shop, a room or boss, the Pub, the finale). All runs
ended with no page errors.

| Step | iPhone 14 | Android 740x360 | ALT iPhone |
|---|---|---|---|
| Boot, Enter gate tap, Add to Home Screen guide on the first title, NOT NOW closes it | ok | ok (with FULL SCREEN; the first tap goes fullscreen) | ok |
| Title → WATCH TV → guide: a drag scrolls 143 px (113 on Android) and plays nothing; a still tap plays (user feedback 3) | ok | ok | ok |
| NEW GAME, character select (a tap picks, PLAY AS confirms), difficulty, banter by tap | ok | ok | ok |
| Home welcome: pills AUTO / LOG / SKIP; LOG lists the lines so far, ✕ closes; SKIP asks (KEEP READING / SKIP SCENE) then skips | ok | ok | ok |
| Home: the stick walks right (+230 px) and up; no stuck input; ACTION reads WATCH at the telly; KrelTV story broadcast; out by touch | ok | ok | ok |
| Pause (II) → 📱 PHONE SETTINGS (14 rows, DONE) → CONTROLS picture (walking, fights, side rooms, brawl tabs) → RESUME | ok | ok | ok |
| Hub: the stick walks; no stuck input | ok | ok | ok |
| Kreddle Exchange: a tile tap picks and buys nothing; BUY buys (3000 → 2880); the ✕ leaves to the Hub | ok | ok | ok |
| Krezz Arms cards | ok (N4) | ok | - |
| Top-down Wildern room as Mikey: stick plus FIRE plus DODGE with two fingers; 9 of 9 enemies down; no stuck input | ok | ok | smoke |
| Upright mid-fight: the rotate screen shows and the game loop stops (no frames); turned back, the pause menu waits (never straight back into the fight); no stuck input | ok | ok | smoke |
| Hidden mid-fight (visibilitychange / pagehide, a thumb on the stick): the loop stops; back, the pause menu waits; no stuck input | ok | ok | smoke |
| Pause in a fight → CONTROLS opens on FIGHTS | ok | ok | smoke |
| Boss (Krandall): auto-fire takes 909 → 243 in 15 s of stick play; at low HP the boss falls, its line plays, then the **KRELTALITY** prompt: a 106 px ring under the right thumb and SPARE beside it, no key names. Tap → KrelCine → back to the fight | ok (probe) | ok (102 px, in the run) | smoke |
| Side room (Catford High Street): tap = hop 76 px, hold = 140 px, a second press in the air = 206 to 216 px; stick right + JUMP together runs and jumps; stick up alone does not jump (x-only); 25 s of run and jump crossed the pits into the next room (x 3359) losing 50 HP; pause → CONTROLS on SIDE ROOMS; no stuck input | ok | ok | smoke |
| Krezz Arms brawl (sit down at 80% drunk): "BRAWL! Tap to swing", taps swing, it ends, back to the Hub, no stuck input | ok | ok | smoke |
| Finale brawl: PUNCH / BLOCK / VANISH / KICK / KI and II on the phone layer, the canvas pad not drawn; punches and the stick leave no stuck input | ok | ok | smoke |
| `?mobile=0` on a phone behaves like the laptop: fingerprint chains run as an iPhone (front, newgame, hub, dungeon: 37 states) and as a small Android (front, newgame, dungeon: 24 states), head `?mobile=0` against base e8cf3f4f `?mobile=0` | **37/37 identical** | **24/24 identical** | - |

"(probe)" on iPhone: in the fight run my script tapped through the boss's death line with SKIP and never saw the prompt.
A separate probe that taps the line along the way a player would saw the prompt at once and took the tap (screenshot
`iphone-krel-41.png`). The Android fight run saw it and tapped it.

"stuck input" was checked after every section. It means `TOUCH.mx/my` back to 0, no held edges, and no control pressed or
live. `TOUCH.attack` may be true only while auto-fire has a target and FIRE is not held. The one `attack: true` after a
side-room pause was auto-fire on an enemy 70 px away (`autoFiring: true, fireHeld: false`), which is correct.

### Sizes, text and the bottom strip (measured with `audit.js` on every screen above)

- **Controls under 44 CSS px:** none of the layer's buttons. The fight's top chips (juice 64x32, bongo 56x32, SANMIK 76x32
  with hit boxes 72x40 / 64x40 / 84x40) are under 44 tall. They are optional quick-use chips in the HUD strip with 8 px
  between them, so a mis-tap only drinks or swaps, and they are no worse than the stage 2 design. Noted, not a blocker.
  The 44 px hit expansion covers the canvas buttons drawn smaller than 44 (title DEBUG, the Enter gate's button).
- **Reading text under 15 CSS px:** the dialogue body, choices, the LOG, the TV guide rows, the shop's detail and the
  settings rows' titles are all at 15 or more. Text that is smaller: secondary lines (see N3).
- **Bottom 21 px (iPhone):** found by sampling `elementFromPoint` across the strip on every DOM screen: nothing
  tappable on the guide, the settings page, the LOG, the SKIP confirm, the TV guide, the shop or the Controls picture.
  The layer's buttons all end at or above y 369 (FIRE / JUMP bottom 359). Slight intrusions are listed in N4.

## 4. Worktree, commits, names

- `git status` is empty, there is no stash and HEAD is 06d2ac08.
- All 37 phone-branch commits (`27107ea1..HEAD`) end with exactly the two required footer lines (checked by script). The
  other commits in `e8cf3f4f..HEAD` are the live game's own.
- There is no model name or e-mail address in any added line of `git diff 27107ea1 HEAD`, nor in any commit body outside
  the footer. Author and committer are `noreply@anthropic.com` on all 37.

## Findings (none blocks the release)

**N1. Fight-button captions print on top of each other (should fix).** At 844x390 with the iPhone insets and at
740x360, the captions under the right cluster collide. In top-down fights, SWAP sits on DODGE's caption and SPECIAL on
FIRE's. In side rooms, SPECIAL sits on JUMP's and DODGE's covers FIRE's ("FI DODGE"). In the finale brawl, PUNCH sits on
KICK's and BLOCK's on VANISH's. Reproduce: iPhone 14 landscape, insets 47/47/21, `toFight("wildern", 0, 2, "MIKEY")`
or `("arena_sanmik", 1, 5)`, or `Finale {beat:"brawl"}`, then look under the buttons. Screenshots: `iphone-20-room.png`,
`iphone-27-after-boss.png`, `iphone-30-side.png`, `iphone-43-finale-brawl.png`, `android-20-room.png`. The buttons carry
their own word, so nothing is lost, but these are the first-time teaching captions and they read as clutter, which is the
user's dungeon complaint. Fix: drop a caption when it would hit a neighbour, or place it beside the button instead.

**N2. Long room names run over the player's name in the phone HUD (should fix).** In side rooms the top line
"THE SANMIKVERSE (CATFORD, ALLEGEDLY) · Job Centre Plus (Catford Branch)", raised by the font floor, is drawn over
"FLENKY JENKY" and the coin count. Reproduce: iPhone or Android, `arena_sanmik` room 1, run right into the Job Centre.
Screenshots: `iphone-32-side-later.png`, `android-32-side-later.png`. Fix: on a phone, clip or shorten `roomT` to the gap
between the name and the weapon chip, or show it only as the room's own title card.

**N3. Secondary text under 15 CSS px (known; part deferred).** The conversation body, choices, LOG, TV guide rows and the
shop's detail all reach 15 CSS px or more. These read smaller:
- The character bios, the difficulty and banter descriptions and the first dungeon's how-to card read at 11.6 CSS px.
  This is the known P12 remainder, already deferred to stage 4.
- The Add to Home Screen guide's step text is 12 to 14 px, and its "why" line is 13 px (stage 1 layout, built to fit
  750x340 with no scroll).
- The Phone settings page's descriptions are 12 px and its option buttons 12.5 px.
- The shop's tile names are 13.5 px.
- The HUD labels are 11.6 px.
- A decorative sign at Home ("BANNED. NEVER BEATEN.") reads at 5.6 CSS px because the floor leaves it alone (a scale
  under 0.5).
None of these blocks reading the story. All are worth a pass in stage 4 on a real phone.

**N4. Small intrusions into the iPhone's bottom 21 px (should fix, minor).** The Krezz Arms "Leave" card is drawn at y
350 to 385 CSS (16 px into the strip, with its centre at 367, just above it), at 844x390 with insets, in
`iphone-18-pub.png`. The Phone settings page's Rhythm sync − / + reach y 372 (3 px), and the KRELTALITY ring's bottom
edge about 1 px. Each one can still be tapped above the strip. The Pub is a stage 2 menu, so its Leave card should move
up by about 20 game px on phones.

**N5. Side room start: JUMP is see-through and its caption is covered.** At the start of Catford High Street the first
pit (x 918) sits under the right cluster, so JUMP, SPECIAL and FIRE go see-through (the P3 design: let the player see
the gap). Together with N1, a first-time player's first look at JUMP is a faint ring under an overlapping caption
(`iphone-30-side.png`). It works (every jump test passed). Consider keeping JUMP solid until the player is near the gap.

**N6. The narrator tip at Home slightly over-promises.** On phones "TIP: WASD / arrows (or the stick) to walk. E to use
things." becomes "TIP: Drag on the left to walk. Tap things to use them." Tapping the prompt's target or ACTION works.
Tapping any object at Home is the user's stage 3 request ("tap environmental things"), so until then "Tap ACTION (or the
thing) to use it" would be exact. The laptop line is unchanged. The narrator rules apply only to NARRATOR lines, and the
whole-game scan test (`tests/mobileWordingScan.test.ts`) passes.

**N7. On Android (no inset) the settings page and the Pub run to the very bottom edge.** Android Chrome reports no
bottom inset, so the 21 px rule does not apply. With gesture navigation, the bottom row (Rhythm sync −/+, y 330 to 374 at
740x360) sits on the system's swipe-up zone. Minor; check on a real device in stage 4.

What still is not great for "mega intuitive", for the record: the top-down fight shows 9 things on a calm screen. These
are pause, the weapon chip, the juice, bongo and SANMIK chips, FIRE, DODGE, SWAP and SPECIAL; READY and HEAL appear only
when they matter. That is cleaner than live (the old 12-bubble pad is gone in every fight), but SWAP and SPECIAL are
shown when nothing special is ready. Auto-fire killed a 9-enemy room in about 4 s with the chapter 2 kit, so the fights
are easy by touch. That is a balance question for stage 4 on real phones. Nothing was tried on a real phone. All of the
above is Playwright emulation.

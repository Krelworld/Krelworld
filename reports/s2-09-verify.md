# Stage 2: independent pre-publish check

Branch `mobile`, worktree `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt`, head
**37a710d4**. I did not write this code. Every result below comes from a run I made on this head, with my own dev servers
(normal 5203, ALT 5213), one browser at a time. I fixed nothing and made no commits.

## Verdict: PASS (no blockers)

- **Laptop unchanged.** Every fingerprint matches its baseline, including the devices next to a phone. The baselines and
  `index.html` are untouched, and a production laptop boot never fetches the phone chunk.
- **Phone smoke passes in both builds:** 418 of 418 each.
- **The user's complaints, checked by real touch on iPhone 14 (844x390, insets 47/47/21) and Android (740x360):**
  - The TV guide scrolls on a thumb drag and never plays a show; a still tap plays the show you tapped. This holds from
    the title's TV and from the Home telly.
  - Peep Show is in the guide on a fresh save.
  - "Whatever's on" played no show twice in 20 skips.
  - No fight shows a control that can't be used right now.
  - The first pit in the side room can be jumped by touch.
  - The brawl, the Krezz Arms and the Add to Home Screen guide all fit.
- **Four findings, none of them blockers.** They are cosmetic and listed in section 4.

## 1. Full check

| Check | Result |
|---|---|
| `git diff origin/claude/krelworld-game -- tests/fingerprints index.html tests/desktopInvariants.test.ts` (also `src/main.ts`, `vite.config.ts`) | empty (origin tip 455b3131 is an ancestor of HEAD) |
| (a) fingerprint `shell,front,newgame,hub,meeting,dungeon` (main + ALT) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** (272 s) |
| (a) fingerprint `boss,side,places,minigames,finale,alt` | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** (305 s) |
| (b) touchlaptop / ipad / fire7 (`front,newgame`) | 16/16, 16/16, 16/16, all **OK** |
| (b) androidtab (`front,newgame,hub`) | 29/29 **OK** |
| (c) `npx vitest run tests/desktopInvariants.test.ts` | 19/19 pass |
| (d) `npx tsc --noEmit` | clean |
| (d) `npx vitest run` | 44 files, 550/550 pass |
| (e) `mobile-smoke.cjs` normal (5203), in 4 batches covering all 20 sections | 143 + 110 + 72 + 93 = **418 of 418**, every batch MOBILE SMOKE: OK |
| (e) `mobile-smoke.cjs` ALT (5213), in 4 batches | 143 + 110 + 93 + 72 = **418 of 418**, every batch OK. The side room's tap-hop check passed in this run; the polish round had seen it flake under load |

Logs are in `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/work/s2-verify/`
(`fp*.log`, `tsc.log`, `vitest.log`, `smoke-main-*.log`, `smoke-alt-*.log`).

## 2. Production builds

I built both into `.../mobile/work/verify/` (`vite build --outDir`; the ALT build with `VITE_KREL_ALT=1`). Both built
cleanly; the only warning is Vite's usual chunk-size notice. I served each with `vite preview` and tested two boots:

- **Laptop (1280x720, mouse):** it passed the Enter gate and reached the Title. The browser fetched exactly one script:
  `index-B5DwsUHf.js` for main, `index-BPsTBXqD.js` for ALT. It never requested the phone chunk (`index-B9ePhBEv.js` /
  `index-QwA4wG7G.js`). `<html>` has no class, there is no `__krelMobile`, and there were no page errors. localStorage
  holds only the usual keys; ALT's carry the `alt:` prefix.
- **iPhone (control run, to show the test can fail):** the phone chunk is fetched, `html.mobile` is set and
  `__krelMobile` exists, with no errors.

I deleted the builds afterwards.

## 3. By real touch (CDP touch events, no mouse)

The scripts are `run-tv.cjs` and `run-fight.cjs` in the work folder. Both are the smoke's helpers plus my own checks.

### a. TV guide scrolling (the user's complaint)

I ran this on iPhone and Android in the main build, and on iPhone in ALT. Every check passed (16 of 16 per run).

- **From the title** (fresh save): I tapped WATCH TV, a show played, then I tapped ON DEMAND.
- **From the Home telly:** I walked up and tapped the ACTION button ("WATCH").
- **The guide:** in both places the guide is the phone list (55 rows), not the canvas.
- **Drags:** I made six finger drags that started on a row: up 160 px, a fast 120 px, a slow 90 px after a 250 ms rest,
  down 120 px, and short drags of 40 px and 20 px. Each one scrolled the list (0 → 145 → 250 → 325 → 220 → 245 → 250),
  and the TV stayed in `episodes` mode every time. A quick 150 px flick also scrolled without playing anything.
- **A still tap on a visible row** played exactly that show (for example `krews_chomsky_triad`), and the list closed.
- **No repeats:** 20 NEXT SHOW taps by touch, from the title and from Home. Out of 55 shows, the 21 shows each time were
  all different, never the same show twice in a row. The code matches: `surf()` keeps a round set per title and per run,
  puts unseen shows first, and starts a new round only after every show has played.

### b. Peep Show

`beep_show` ("Peep Show: Oil Be Seeing You") is in the title's guide on a fresh save, and in Home's guide. It also turned
up naturally among the skips (Android title, iPhone Home). It is no longer one of the "story" episodes, so
"whatever's on" can pick it.

### c. Fight screens: overlaps and controls that can't be used

These are real fights: enemies left in place, the stick held, auto-fire on, measured every 1.2 s for 6 to 7 s. The
counts include the stick.

| Situation | iPhone 844x390 | Android 740x360 |
|---|---|---|
| Wildern room 2, chapter 1 kit (40 Krezz, 2 juice, 1 bongo, Fart Blaster) | 7 to 8: pause, FIRE, DODGE, SPECIAL (DASH can go), gun chip, bongo, stick, and juice once hurt; 💨 joins once the fart meter fills | 7, then 8 as on iPhone |
| Ministry (chapter 3's own kit, Cuddle Cronster room) | 8 to 9: + SWAP, juice once hurt, 💨 when charged | same |
| Krandall boss (chapter 2 kit) | 7 at full health; 8 to 9 in play (juice once hurt, 💨) | same |
| Side room start (Catford High Street) | 8: pause, FIRE, JUMP, DODGE, SPECIAL, gun chip, bongo, stick | same |
| Finale brawl | 6 buttons (PUNCH, BLOCK, VANISH, KICK, KI, pause); the stick shows when touched | same |

- **"Nothing shown that cannot be used right now": passed every time.**
  - SPECIAL appeared only with `specialReady`.
  - READY never appeared without something ready.
  - The juice chip never appeared at full health.
  - SWAP appeared only with a second loaded gun.
  - The bongo chip appeared only with a bongo.
  - There were no dim "for later" bubbles. The user's complaint about the right side is fixed.
- **No captions collide.** The only caption outside a button is the stick's teaching word MOVE (first fights). Fight
  buttons never overlap each other. No control sits in the bottom 21 px.
- **Overlaps my checker flagged:** they are covered in section 4. Most were bounding-box hits between canvas texts: the
  player name's box touches the HP line's box by 1.5 px, but the letters do not touch (probe crop
  `probe-iphone-hud-topleft.png`).

### d. Side room, first pit, finale brawl, Krezz Arms

- **Catford High Street, first pit** (x 918 to 1068). I held the stick right with the left thumb, then pressed JUMP
  with a second finger, held 380 ms, while the stick stayed held.
  - A comfortable press 45 px before the edge crossed cleanly on both phones.
  - A late press 15 px before the edge also crossed on both phones.
  - Neither attempt fell or respawned. The player landed at x 1159 to 1203.
- **The finale brawl:**
  - The five buttons and pause sit in the right gutter with no overlaps.
  - The touch-worded move help line is at the top.
- **The Krezz Arms:**
  - The Leave card's centre is at y 345 at 390 tall, and y 319 at 360 tall, so it is clear of the 21 px strip.
  - No control covers it, and a tap on it leaves the pub.

### e. Add to Home Screen guide, iPhone Safari steps

| Size | Card (top to bottom) | Steps (top to bottom) | CLOSE / GOT IT | Card scroll | Page scroll |
|---|---|---|---|---|---|
| 844x390 | 12 to 376 | 76 to 251 | 318 to 362 (44 px) | 0 | 0 |
| 750x340 | 14 to 324 | 66 to 214 | 272 to 316 (44 px) | 0 | 0 |

At both sizes every step and both buttons are on screen, with nothing to scroll.

## 4. Findings (not blockers)

1. **A long boss line runs under the weapon chip** (phone HUD, both phones).
   - **What happens:** while a boss is shielded, its line becomes for example "KRANKY KRANDALL [SHIELDED 2/4 - KILL THE
     MINIONS]". It is 297 CSS px wide, centred at the top (x 312 to 609 at 844x390). The weapon chip starts at x 581, so
     the last 28 px ("MINIONS]") sit under its edge. The chip is see-through enough that the text stays readable.
   - **Also:** the line's left end touches the KREZZ/WONK label's box by about 2 px. The shield badge is drawn over the
     "K" of the boss name (crop `probe-iphone-boss-top-0.png`).
   - **Where else:** the same happens in the Cuddle Cronster fight.
   - **Status:** s2-01 reported the KREZZ part; the chip overlap is new to this report.
   - **Suggested fix:** fit the boss line the way `roomName.ts` fits the room line: shorten or shrink the shield tag
     when it would reach the chip.
2. **Canvas banners stack on the weapon card** when a fight starts (Ministry and Cronster, `iphone-room-mid.png`).
   - **What happens:** the boss banner ("CUDDLED: He's squeezing out all your lovely juices...") and the objective hint
     ("Get to SHEZLEIGH first and tap ACTION...") print over the weapon card for about 1.7 s.
   - **Why:** the card shows on room entry because the kit auto-picks the best gun, not only after a swap as the polish
     report says.
   - **Phone only?** All three are the game's own canvas pieces, and the phone puts the card up top. I did not check
     whether the laptop overlaps in the same way.
3. **Labels at the edge of the play area sit under the buttons.**
   - **Cronster room:** the hostage prompt "SHEZLEIGH (tied up: tap ACTION…)" at the room's right edge sits under SWAP
     and FIRE, and the left-hand one is clipped by the picture edge.
   - **Side room start:** a canvas word ("OP!") peeks out at the bottom right.
   - **Why:** both are in-world labels near the edge of the picture.
   - **Worth noting:** stage 3's "tap things to use them" would help with hostages.
4. **Brawl header:** the boss's name ("THE CONCEPT OF … ABRIDGED") ends right against the pause button (about 748 vs
   745 CSS px) at 844x390. It is cosmetic.

**Also from this run:**

- **Smoke coverage gap:** the smoke itself never measures controls against the HUD's canvas texts, or canvas texts
  against each other, which is why findings 1 and 2 passed it.
- **My checker:** it flags 1 to 2 px box contacts between canvas texts that don't show on screen. Its "FAIL" lines in
  the logs are those false positives, plus findings 1 and 2.

## 5. State left

- **Servers:** my dev and preview servers (5203, 5213, 5233) are stopped. The servers still running on 5222 and 5232
  belong to the other agent's worktree (`mobile-feel-wt`).
- **Builds:** the production builds and the `verify/` folder are deleted.
- **Worktree:** clean (no status, no stash) at 37a710d4. Nothing was committed or pushed, and the main checkout was not
  touched.
- **Screenshots:** 30, at 1x, plus two cropped probes, in
  `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-verify/`.

export const meta = {
  name: 'krelworld-mobile-stage2-polish',
  description: 'KRELWORLD phone stage 2 polish: declutter the fight buttons and HUD (gate N1, N2, N4, N5 and the user dungeon-clutter note), then an independent pre-publish check',
  phases: [
    { title: 'Polish', detail: 'fix the gate findings and the dungeon clutter' },
    { title: 'Verify', detail: 'independent full check, touch play and screenshots' },
  ],
}
const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const UI_WT = SP + '/mobile-ui-wt'
const AUDIT = SP + '/mobile_audit/MOBILE_AUDIT.md'
const REPORTS = SP + '/mobile/reports'

const CHECK = (P) => `start your own dev servers from the worktree you are in (normal: "npx vite --port ${P} --strictPort"; ALT: "VITE_KREL_ALT=1 npx vite --port ${P + 10} --strictPort"), then:
  (a) laptop check, two halves, each must end "DESKTOP FINGERPRINT: OK":
      node scripts/desktop-fingerprint.cjs --url http://localhost:${P}/ --alt-url http://localhost:${P + 10}/ --check --only shell,front,newgame,hub,meeting,dungeon
      node scripts/desktop-fingerprint.cjs --url http://localhost:${P}/ --alt-url http://localhost:${P + 10}/ --check --only boss,side,places,minigames,finale,alt
  (b) the devices next to a phone (must all be OK):
      for p in touchlaptop ipad fire7; do node scripts/desktop-fingerprint.cjs --url http://localhost:${P}/ --no-alt --profile $p --only front,newgame --check; done
      node scripts/desktop-fingerprint.cjs --url http://localhost:${P}/ --no-alt --profile androidtab --only front,newgame,hub --check
  (c) "npx vitest run tests/desktopInvariants.test.ts" passes and that file, tests/fingerprints/ and index.html are UNEDITED (never re-record a baseline; if a check fails, your change touched a non-phone device: fix the change);
  (d) "npx tsc --noEmit" and "npx vitest run" pass;
  (e) phone smoke: "node scripts/mobile-smoke.cjs --url http://localhost:${P}/" and "node scripts/mobile-smoke.cjs --url http://localhost:${P + 10}/" pass (see src/game/mobile/README.md for --only sections).
Stop your servers when done: pkill -f "vite --port ${P}" ; pkill -f "vite --port ${P + 10}"`

const CTX = `
# Project context (read all of this first)

KRELWORLD is a private comedy action-RPG (Phaser 3.90 + TypeScript + Vite) that plays in a browser. It was built for laptops (keyboard and mouse). We are making it properly playable in a PHONE browser held sideways (landscape), WITHOUT changing the laptop version in any way.

## The user's instructions (verbatim, they are the spec)
- "Right now the game is basically unplayable in a phone. ... a full audit and change of the game for a phone browser version (making NO changes to the main laptop version of the game). I think things like combat would need to be either simplified or optimized, and special buttons etc would need to be changed to screen taps, but also in a way that didn't obscure or fuck with gameplay too much. Should be played sideways on phone."
- "Do everything we just spoke about. Make the game playable on a phone. Do *not* change the laptop experience. Refer to *all* the notes you made. Make sure the user experience is comfortable, that jumping etc doesn't feel awkward. ... Do *not* change the main game, you are making it playable on phone."
- "I know the phone version probably won't be as good as the laptop but I want it to be mega intuitive and fun. Please help and get it done"
- "Also it should be optimized for landscape mode on the phone"

## Required reading, in this order
1. ${REPORTS}/00-USER-PRIORITIES.md : what "mega intuitive and fun", "landscape" and the rest mean for every decision. It overrides anything below that conflicts with it (except the hard rules).
2. ${REPORTS}/RESEARCH-phone-games.md : how comparable games work on phones. Section 3 is a prioritised change list (MUST M1-M16, SHOULD S1-S15, COULD, "Do not build"), then "Jumping (detailed)" and "Right-hand cluster, layout v2" with exact positions and sizes, then section 4 (numbers). Where it gives a MUST or SHOULD for the part you build, follow it; where you deviate, say why in your report.
3. ${WT}/src/game/mobile/README.md (or the same file in your own worktree): the phone module as it stands after stage 1: flag, boot chunk, shell, touch layer and its mode/controller API (registerModeController, layer.addControl, TouchControl, SCENE_RULES/addSceneRule, the decision fields stick "2d"/"x", legacyPad, pause, action verb), settings store, readability switch, hint()/touchWording, diagnostics, Add to Home Screen guide, smoke test.
4. Stage 1 reports in ${REPORTS}/: 02-build1.md, 03-build2.md, 04-fix-round1.md, 05-gate-round1.md, and DEFERRED.md (its "Stage 2" sections are yours to close: P9, R8 remainder, R8 item 7, R11, P10, P12, P14, P16, P4 remainder, R3 follow-up).
5. The original phone audit ${AUDIT} (sections 2 and 3 for your part). Its screenshots are in ${SP}/mobile_audit/shots/, and ${SP}/mobile_audit/work/harness.cjs knows how to reach every scene.

## Where the effort stands
- Stage 1 is LIVE (phone flag, shell, rotate screen, walking controls everywhere, settings store, readability mechanism switched off by default, touch wording helper, ?mobilediag, Add to Home Screen guide). On phones, combat still uses the game's OLD canvas touch pad.
- THIS workflow is stage 2: combat and jumping controls plus the phone HUD, and menus, dialogue, readability and the touch wording sweep.
- Stage 3 (not yours) covers minigames and special scenes (rhythm, driving, Cam2Cam, Norwich, Polson bulking, plane, colon voyage and the like), iPhone audio, memory and performance.
- Stage 4 (not yours) is full QA.
- Where a scene sits on the boundary, the rule is: anything inside a combat scene (top-down dungeon rooms, boss fights, side-scrolling rooms, brawls, finishers such as Kreltalities, and mash or quick-time prompts inside those fights) is stage 2. Self-contained minigames are stage 3.

## Hard rules
1. LAPTOP UNCHANGED. On any device that is not a phone (laptops, touchscreen laptops, iPads, Android tablets, the Fire 7), the game must behave, look, sound, save and perform exactly as before. Phone mode is the runtime flag isMobile().
2. Containment: new phone code lives under src/game/mobile/ (it loads as the lazy phone chunk through boot.ts; keep it that way: laptops must not fetch it). Existing game files may only get small guarded hooks ("if (isMobile()) ...", "isMobile() ? a : b") or imports of flag.ts. Game-rule changes that only phones get (jump buffer, coyote time, variable jump height, ledge forgiveness, auto-collect radius, aim assist) are allowed as such guarded hooks. Prefer observing and driving the game from outside. Do not edit index.html, the scene list in main.ts or the Phaser game config.
3. DIALOGUE. Never change, add, remove or reword any dialogue or story text. The user said, verbatim: "YOUR QA WAS NOT FOR DIALOGUE. If you've made any changes to dialogue, revert them." Showing existing lines differently on phones (bigger text, re-paginated into more boxes, a back-log of lines already shown, skip or auto-advance) is allowed; the words stay identical.
   One narrow exception: a pure control instruction shown by the game's own narrator or system voice, not spoken by a character (for example Home's "TIP: WASD / arrows (or the stick) to walk. E to use things."), may be swapped for touch wording ON PHONES ONLY through hint()/touchWording, with the laptop line unchanged. A character's line that mentions a key stays exactly as it is. List every line you swapped and every character line that mentions a key in your report.
4. Both builds: main and ALT (VITE_KREL_ALT=1, src/game/variant.ts). Phone mode works identically in both; add no ALT-only differences. Use storageKey() for any localStorage key.
5. Content: no new story content of any kind. This is a controls, layout and readability job.
6. Never write a model name or the user's email address into any file, commit message or comment. End every commit message with exactly these two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VMaYe2CeeKzcmBuCUqa9Rb
7. Commit in your worktree with clear messages (what changed for the player). Leave the worktree clean when you finish. NEVER edit, checkout, reset or stash anything in /home/user/Rory-s-rangers- (the main checkout). NEVER push and never create a PR: the coordinator pushes after review.

## The machine (important)
- 4 CPUs, 15 GB RAM, about 12 GB disk free. Another agent runs at the same time as you.
- Run ONE browser at a time and close it when a script ends. Keep screenshots at 1x for your own checks, at most about 40, no frame dumps. Production builds go to a temp folder under ${SP}/mobile/work/ and are deleted straight after.
- It is slow: a page boot takes 15 to 60 seconds. Use generous timeouts (120 s+). Run commands in the foreground.
- node_modules is a hard-linked copy: never modify or reinstall packages. No npm or pip installs. Playwright and Chromium are preinstalled (require('playwright'); chromium.launch() needs no options).
- If a git command fails with a lock error, wait a few seconds and retry. Never run git gc or git prune.
- Scratch files go under ${SP}/mobile/work/<your-role>/ and screenshots under ${SP}/mobile/shots/<your-role>/, never in the repo unless they are a deliverable.

## How to drive the game
- The page opens on an "Enter" gate (tap or Enter) and then the Title.
- Debug API: window.__krel (newRun, setChapter, state(), scene(k), tp(x,y), game). In a dev page "await import('/src/game/Flow.ts')" works (switchTo and so on). On phones window.__krelMobile exposes the phone module (see its README).
- src/game/scenes/DebugScene.ts (DebugSkip: goCh / goArc / goBoss) drops you into any chapter, side quest or boss. Chapter Select's password is "krunt".
- Phone emulation in Playwright: iPhone 14 landscape = viewport 844x390, deviceScaleFactor 3, isMobile true, hasTouch true, a mobile Safari user agent (use the smoke test's profiles and its iPhone safe-area insets 47/47/21); also 750x340 (Safari with bars), small Android 740x360, large phone 932x430, portrait 390x844. Drive with real touch events (CDP Input.dispatchTouchEvent for drags and multi-touch), never mouse clicks.
- Deterministic stepping reference (fake clock, runFor per frame): ${SP}/tvtrailer/tvcap.cjs.
`

const BUILD_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  hooksOutsideMobile: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, what: { type: 'string' } }, required: ['file', 'what'] } },
  apiSummary: { type: 'string' },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'smoke'] },
  dialogueLinesMentioningKeys: { type: 'array', items: { type: 'string' } },
  narratorTipsSwapped: { type: 'array', items: { type: 'string' } },
  gaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
  required: ['ok', 'commits', 'apiSummary', 'checks', 'gaps', 'notes'] }

const MERGE_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, headCommit: { type: 'string' }, conflicts: { type: 'array', items: { type: 'string' } },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'smoke'] },
  notes: { type: 'string' } },
  required: ['ok', 'headCommit', 'conflicts', 'checks', 'notes'] }

const FINDINGS_SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, area: { type: 'string' },
    title: { type: 'string' }, detail: { type: 'string' }, repro: { type: 'string' }, suggestedFix: { type: 'string' },
    affectsLaptop: { type: 'boolean' } },
    required: ['id', 'severity', 'title', 'detail', 'affectsLaptop'] } } },
  required: ['summary', 'findings'] }

const FIX_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  dispositions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, action: { type: 'string', enum: ['fixed', 'rejected', 'deferred'] }, reason: { type: 'string' } }, required: ['id', 'action', 'reason'] } },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'smoke'] },
  notes: { type: 'string' } },
  required: ['ok', 'commits', 'dispositions', 'checks', 'notes'] }

const GATE_SCHEMA = { type: 'object', properties: {
  pass: { type: 'boolean' }, laptopUnchanged: { type: 'boolean' }, mobileSmoke: { type: 'boolean' },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, buildMain: { type: 'boolean' }, buildAlt: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'buildMain', 'buildAlt'] },
  blockers: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' }, affectsLaptop: { type: 'boolean' } }, required: ['id', 'title', 'detail', 'affectsLaptop'] } },
  headCommit: { type: 'string' }, notes: { type: 'string' } },
  required: ['pass', 'laptopUnchanged', 'mobileSmoke', 'checks', 'blockers', 'headCommit', 'notes'] }

// ---------------------------------------------------------------- 1. Build (two tracks in parallel)
phase('Build')


const GATE_REPORT = REPORTS + '/s2-07-gate-round1.md'
phase('Polish')
const polish = await agent(`${CTX}

# Your role: stage 2 POLISH (one agent, worktree ${WT}, branch "mobile", dev ports 5202 / 5212)

Stage 2 is built, reviewed, fixed and has PASSED its gate (head 06d2ac08). The coordinator then merged the live game into "mobile" (commit 5bb649ec: KrelTV no-repeat rounds, Peep Show unlocked from the start, two shows removed; the laptop fingerprint baselines for tv_from_title, tv_guide and pub were re-recorded deliberately on the live branch and came in with that merge, so the checks should pass as they are).
Before publishing to players, fix what the gate flagged as clutter. Read ${GATE_REPORT} (findings N1-N7, screenshots in ${SP}/mobile/shots/s2-gate1/) and the "Latest feedback" section of ${REPORTS}/00-USER-PRIORITIES.md first.

The user's own words about the live phone build: "right now in dungeons on right hand side of the screen you can see a bunch of bubbles for every potential special even when they're not active, can you make sure reviewing playability here is part of the audit, and just making sure a good option is settled on for UI in the phone version".

Do:
1. N1 (must): the first-time captions under the right-hand cluster print on top of each other in top-down rooms, side rooms and the finale brawl (iPhone 844x390 with insets 47/47/21, Android 740x360, also 750x340 and 932x430). Settle on ONE clean approach: e.g. captions only where they cannot collide (placed by measured rects with a collision pass, dropped otherwise), or one caption at a time, or the word inside the button only. No caption may overlap another caption, a button, or the HUD.
2. The user's clutter point (must): in a top-down room, count every phone control and chip visible at once (both sides and the top-left chips). Anything not usable right now (a special with no charge, a drink with 0 left, SANMIK when it cannot swap, READY with nothing ready, HEAL when not needed) should be hidden or clearly dormant and unobtrusive, not a row of bubbles. Decide, implement, and write down in your report the final rule and the before/after count per situation (fresh room with ch1 kit; mid-game kit with everything charged; boss). Keep what a thumb needs: stick, FIRE, DODGE, SWAP (when more than one gun), pause. Check the screenshots the gate took (iphone-20-room.png shows a SPECIAL/NUKE stack, top-left chips and the weapon-picker banner all at once).
3. N2: on phones clip or shorten the side-room room-name line so it never overlaps the player name or coins (no wording change of dialogue; a room name may be ellipsised or hidden on phones).
4. N4: move the Krezz Arms "Leave" card clear of the iPhone bottom 21 px on phones.
5. N5: at side-room start make sure JUMP is recognisable the first time (e.g. the see-through occluder rule leaves JUMP at least clearly visible as an outline with its icon), without hiding the pit under it.
Leave N3, N6, N7 as they are (deferred).

Every change must be phone-only (isMobile guards / phone chunk). Add or update smoke checks so caption overlap and the per-situation control count are tested (a measured no-overlap check over all visible controls and captions at 844x390 and 740x360). Then run the FULL check: ${CHECK(5202)}
Run the phone smoke in section batches if one run is too long for the 10-minute tool limit (sections in the README). Take before/after screenshots (1x) into ${SP}/mobile/shots/s2-polish/: top-down room fresh, top-down room mid-game, boss, side room start, finale brawl, pub; at 844x390 iPhone profile and 740x360.
Write your report to ${REPORTS}/s2-08-polish.md. Commit in small steps with the footer. Worktree clean at the end, servers stopped, nothing pushed.
Return JSON per the schema (dispositions ids: N1, N2, N4, N5, CLUTTER).`, { label: 'polish: declutter fights', phase: 'Polish', schema: FIX_SCHEMA })

phase('Verify')
const verify = await agent(`${CTX}

# Your role: INDEPENDENT pre-publish check of the phone build (worktree ${WT}, branch "mobile", dev ports 5203 / 5213)
You did not write this code. Stage 2 passed its gate, then the live game was merged in (5bb649ec) and a polish agent decluttered the fight screen (see ${REPORTS}/s2-08-polish.md and its commits). This is the last check before it goes live to players. Be adversarial.
1. Run the FULL check: ${CHECK(5203)}
   (Run the smoke in section batches if needed.) Every item must pass. The laptop fingerprints must be OK with NO baseline edits on this branch beyond what came in from the live branch merge (check: "git diff origin/claude/krelworld-game -- tests/fingerprints index.html tests/desktopInvariants.test.ts" must be empty).
2. Production builds of main and ALT into a temp folder under ${SP}/mobile/work/verify/ (then delete them): both build, and a laptop boot of each never requests the phone chunk.
3. By real touch on the iPhone 14 profile (844x390, insets 47/47/21) and small Android (740x360):
   a. TV guide scrolling (the user's complaint: "scrolling doesn't work in that screen, if you try to scroll it just plays the point in the screen that your thumb tries to scroll from"): from the title's TV, and from a room TV (Home), a thumb drag scrolls the guide without playing anything; a still tap plays the tapped show. Also "whatever's on" / next show never repeats a show before all have been shown (sample 20 skips).
   b. Peep Show ("Beep Show") is in the guide from the title on a fresh save.
   c. A top-down dungeon room (fresh ch1 kit and a mid-game kit) and a boss: no overlapping captions, controls, chips or HUD text; nothing shown that cannot be used right now (the user's "bunch of bubbles for every potential special even when they're not active"). Count visible controls and report.
   d. A side room start and a jump across the first pit; the finale brawl; the Krezz Arms.
   e. The Add to Home Screen guide's iPhone steps fit at 844x390 and 750x340 without scrolling.
Screenshots (1x, at most 30) into ${SP}/mobile/shots/s2-verify/. Report to ${REPORTS}/s2-09-verify.md. Do not fix anything yourself unless it is a one-line phone-only fix you are certain of (then commit it with the footer and re-run the affected checks); otherwise list it as a blocker. Servers stopped, worktree clean, nothing pushed.`, { label: 'verify: pre-publish check', phase: 'Verify', schema: GATE_SCHEMA })


return { polish, verify }

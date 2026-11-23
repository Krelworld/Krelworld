export const meta = {
  name: 'krelworld-mobile-stage2',
  description: 'KRELWORLD phone mode, stage 2: combat and jumping controls, phone HUD, menus, dialogue, readability and touch wording; then merge, independent review, fixes and a gate',
  phases: [
    { title: 'Build', detail: 'two tracks in parallel: combat (top-down, then side rooms and brawls) and menus/dialogue (readability and dialogue, then lists, shops and wording)' },
    { title: 'Merge', detail: 'merge the menus track into the combat track and re-run every check' },
    { title: 'Review', detail: 'laptop refuter, blind first-time player, combat and jumping feel, robustness and code' },
    { title: 'Fix', detail: 'fix confirmed findings' },
    { title: 'Gate', detail: 'final laptop and phone checks' },
  ],
}

const RESUME_NOTE = "\n## RESUMING AFTER AN INTERRUPTION (read this first)\nAn earlier run of your role was cut off by a usage limit. Check \"git log e8cf3f4f..HEAD\" and \"git status\" in your worktree: anything already committed or left uncommitted there is that earlier run's work. Keep it and continue from it; do not redo finished parts.\nUsage may run out again at any time. COMMIT IN SMALL WORKING STEPS (at least every 30 to 45 minutes of work, each commit building and passing tsc), so nothing is lost if you are cut off. Write your report file early and keep it updated as you go.\n"
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

const combatTop = () => agent(`${CTX}
# Your role: COMBAT BUILDER, part 1 of 2: top-down fights and the phone HUD
Worktree: ${WT} (branch "mobile"). Vite ports: ${5202} and ALT ${5212}. Scratch: ${SP}/mobile/work/s2-combat1/.
A separate builder is working on menus, dialogue and readability in another worktree at the same time. Do not build those. Part 2 of combat (side-scrolling rooms and jumping, brawls, finishers, controllers) comes after you, in this same worktree.

Goal: a player holding the phone sideways can fight every top-down room and boss comfortably by touch, with the controls feeling obvious from the first second and never covering the action. Replace the OLD canvas pad on phones in top-down combat (tablets keep it: the "androidtab" fingerprint profile pins that).

First, map the ground truth. Read how combat works on a laptop:
- the Controls class (aim, aimPoint, attackHeld, the wasTouch paths);
- TouchControls and TOUCH, and UIScene (setupTouch and the HUD);
- the dungeon and boss scenes;
- every weapon (all eight guns), the auto-switch to the next gun with ammo, dodge;
- every special or meter ability a player can trigger in a fight (IBS, Krezz, transformations, the Cumehameha, spirit abilities and so on), heal items;
- what the combat HUD shows, including the "specials-ready glowing key prompts".
List them in your report with the laptop key for each. That list decides what needs a touch control: every action a laptop player can take in a fight must be reachable by touch.

Build (research M1, M2, M3 remainder, M4, M5, M11, M15, M16, S1, S2, S3, S9, S10 for combat, S11, and the layout v2 table for top-down rooms):
1. A "combat" mode controller registered through the stage 1 API. The decision gets stick "2d" and legacyPad false, so the town's stick zone, gutter included, is the combat stick (DEFERRED P9). Change the UIScene.setupTouch guard so the old pad is not created in phone combat either. Use guarded hooks in Controls.aim / aimPoint / attackHeld where the phone controller must supply aim and fire.
2. FIRE in the prime slot, with auto-fire per M1:
   - The setting is autoFire, ON by default in top-down rooms for the first device test.
   - Auto-fire shoots only at an enemy in range with a clear line. Never at barrels or crates, never a special, never while a prompt, picker or overlay is open.
   - Holding FIRE fires regardless of target; sliding FIRE aims manually: 24 px threshold, an aim line, snap within 15 degrees.
   - With auto-fire off, firing continues for 200 ms after the thumb lifts.
   - Auto-aim follows M2: nearest enemy biased toward the stick, sticky, falling back to objects; a visible target ring at the target's feet; aimAssist off / normal / strong.
   - Decide the two-switches issue (DEFERRED R8 item 7). Recommended: on phones the hook reads phoneSettings().aimAssist only, and the game's own "Touch aim assist" row is hidden on phones behind isMobile().
3. DODGE, SWAP and SPECIAL as fixed slots per layout v2, not a SMART button (S1). Add a READY slot that pops in when a meter ability is ready and a HEAL slot that pops in under 40% HP (S3). Pop-ins animate in and ignore presses for 150 to 200 ms (S11).
   - The weapon chip at the top (S2, M16): tap = next gun, hold = picker. The picker is a radial capped at four, or a short list. Holds are recognised at 300 ms and cancel if the finger moves more than 12 px.
   - Map every special from your list to a slot. Where a fight has a special the slots cannot hold, add the smallest predictable extra and say why.
4. The research's per-side surface (M3, DEFERRED R8 remainder): inside the right cluster, a touch in a gap goes to the nearest control within 20 px; overlapping hit areas go to the nearest centre. FIRE, DODGE and JUMP act on touch-down with zero delay. A control under a press stays until its touch ends.
5. The phone HUD (DEFERRED P10, for town AND combat, in UIScene behind isMobile()):
   - Nothing interactive or decorative takes touches in the stick zone.
   - The top-right corner is not crowded by pause and the fullscreen offer: shift the toast column and the counters, or move pause.
   - HP and the meters stay readable at the phone scale, and the specials-ready prompts show the touch slot instead of a key.
   - Controls go see-through when the player or the target is under them (stage 1 already does this for walking: extend it).
6. Feedback without vibration (M15): pressed states, a short flash on the slot that fired, and the stage 1 haptics where supported. First-time cues (S10): a one-word caption under each combat icon for the first fights, and a pulse on a control the first time it matters (READY, HEAL, SWAP when the gun is empty).
7. Phone assist (S9, the setting phoneAssist, default on): auto-collect coins, ammo and health inside an enlarged pickup radius, and whatever else makes phone combat fair without slowing the game: for example a slightly more generous dodge window or enemy telegraph visibility, if the research supports it. Never slow the game. The user said combat may be "simplified or optimized": phone assist is where that lives. List exactly what it changes.
8. Flip the live flags in phoneSettingsList() for every setting you wire (autoFire, aimAssist, phoneAssist). The settings SCREEN is the other builder's job: you only make the settings work live.
9. Tests:
   - Unit tests for aim selection, auto-fire rules, slot layout, gap routing and hold recognition.
   - Extend scripts/mobile-smoke.cjs with a "combat" section: reach a top-down room and a boss by DebugSkip; assert the old pad is absent and the new controls are present; stick moves; auto-fire kills a test enemy without touching FIRE; FIRE hold and slide; DODGE; SWAP; the chip tap and hold; READY and HEAL pop-ins; multi-touch (stick plus FIRE plus DODGE); pause mid-fight; rotate mid-fight; hidden mid-fight; and no stuck input after any of these.
   - Measure the control sizes, spacing and cover of the play area at 844x390, 750x340 and 740x360, and record the numbers.
10. Play it yourself with real touch events for at least 3 rooms and 1 boss on the iPhone profile. Look at your screenshots: is anything covering the action, fiddly, or confusing for a first-time player? Fix it.

Verify before you finish: ${CHECK(5202)}
Update src/game/mobile/README.md (combat section). Write ${REPORTS}/s2-01-combat-topdown.md: the action map, the slot map, the settings, the phone-assist list, the measured numbers, every hook outside src/game/mobile and why, and what part 2 should know. Return the structured result.`,
  { label: 'combat: top-down fights and HUD', phase: 'Build', schema: BUILD_SCHEMA })

const combatSide = (c1) => agent(`${CTX}
# Your role: COMBAT BUILDER, part 2 of 2: side-scrolling rooms and jumping, brawls, finishers, controllers
${RESUME_NOTE}
Worktree: ${WT} (branch "mobile"). Vite ports: ${5202} and ALT ${5212}. Scratch: ${SP}/mobile/work/s2-combat2/.
Part 1 just built the top-down combat controls and the phone HUD in this worktree: read ${REPORTS}/s2-01-combat-topdown.md and the README's combat section first. Its summary:
${c1 ? c1.apiSummary : '(part 1 returned nothing: read its report and the git log)'}
Gaps part 1 left: ${JSON.stringify(c1 ? c1.gaps : [])}

The user's words for this part: "Make sure the user experience is comfortable, that jumping etc doesn't feel awkward." Jumping must feel GOOD on a phone. Read the research's "Jumping (detailed)" subsection and section 4's numbers in full before you write code.

Build:
1. A "side" mode controller for every side-scrolling room. The game has several: the Crobley factory, the SanMik Zone, the Nu Warehouse trip, platforming rooms with pits, movers, crushers, steam and conveyors, and any others you find.
   - Use layout v2: JUMP 84 px in the prime corner; FIRE left of it; DODGE and SPECIAL above; READY, HEAL and the weapon chip as in part 1.
   - The stick is x-only (decision stick "x"; full speed at 35% travel), so the stick never jumps or climbs by accident.
   - JUMP fires on touch-down. 150 ms jump buffer before landing; 140 ms coyote time after leaving a ledge. Variable height: a tap gives about a 78 px hop, a hold about 145 px (cut upward speed on release as the research specifies). A second press is the double jump where the game has one. About 100 ms of air-control easing. 100 ms of platform momentum is kept.
   - Drop-through needs a deliberate input: stick down plus JUMP, or a held down. Never a stray drift.
   - Ledge forgiveness 14 to 20 px, plus a ledge pop and corner correction.
   - The camera holds the player at 35% / 65% of the width so the player sees ahead.
   - All of these are PHONE-ONLY guarded hooks in the side-scroller code. Laptop physics stay byte-identical: the "side" fingerprint chain covers the jump arc.
   - Auto-fire is ON by default in side rooms (M1). The jump forgiveness lives under phoneAssist (S9).
   - Measure the jump: run the jump tests at 30, 60 and 120 Hz (S15) with a fake clock. Record buffer, coyote and hop / full heights in your report.
2. A "brawl" mode for the brawls: the Krezz Arms brawl ("Tap to swing" already exists), the Super Saiyan finale brawl, and any other melee section. Big, obvious touch controls for punch, block and special, with the punches feeling massive: keep the game's own hit feedback.
   - Finishers and prompts inside fights: Kreltalities, any quick-time or mash prompt inside combat (research M14).
   - Make every one doable by touch with one big target. A mash is a tap anywhere on the right half; a timed press is a big ring with generous timing on phones. Show the touch wording, not keys.
3. A controller connected to the phone (DEFERRED R11, research S6): add an input source to the view and decision ("touch" | "pad").
   - The first pad button or stick movement hides the touch layer and the old pad; the next touchstart brings them back.
   - The guarded hook in Controls.aim prefers the right stick when it has moved.
   - Note for the settings page (the other builder renders it): "A Bluetooth controller works".
4. The Controls picture (research S10): a labelled picture of the phone controls for walking, top-down combat, side rooms and brawls, drawn from the real layoutSlots() so it is always right, with one plain-language line per control.
   - Open it from the pause menu on phones (a small guarded entry next to the existing items).
   - Another builder is adding a "PHONE SETTINGS" entry to the same pause menu in another worktree. Keep your hook minimal so the merge is easy, and say exactly what you changed.
5. Fullscreen re-offer inside fights on Android (gate note).
6. Tests:
   - Unit tests for the jump buffer, coyote time, variable height maths and the drop-through rule.
   - Smoke sections "side" and "brawl": jump on touch-down; buffer and coyote measured; hop vs full; drop-through only when deliberate; no stuck input when the room or mode changes mid-jump; brawl swing, mash and finisher by touch; pad handover.
7. Play it yourself, by touch, through at least two different side-scrolling rooms end to end, the Krezz Arms brawl and one finisher. Judge it as a player: is any jump awkward? Fix it.

Verify before you finish: ${CHECK(5202)}
Update the README. Write ${REPORTS}/s2-02-combat-side.md with the measured jump numbers, every hook outside src/game/mobile and why, and anything left. Return the structured result.`,
  { label: 'combat: side rooms, jumping, brawls, controller', phase: 'Build', schema: BUILD_SCHEMA })

const uiRead = () => agent(`${CTX}
# Your role: MENUS AND DIALOGUE BUILDER, part 1 of 2: readability, dialogue, phone settings page
Worktree: ${UI_WT} (branch "mobile-ui", made from "mobile" at the end of stage 1; work ONLY here). Vite ports: ${5222} and ALT ${5232}. Scratch: ${SP}/mobile/work/s2-ui1/.
A separate builder is doing combat controls and the phone HUD in the other worktree at the same time. Do not build combat controls or the HUD. Your branch will be merged into theirs afterwards, so keep your hooks small and clearly separated.

Goal: every word a phone player needs to read is comfortable to read, every conversation is quick to get through, and every menu is easy to hit with a thumb, without changing a word of dialogue.

Build (research M7, M8, S4, S11 for choices, S12, and DEFERRED P12, P14, P4 remainder, R3 follow-up, plus the gate's note that the idle stick ring covers the player at Home's far left at 750x340):
1. Readability ON.
   - Fix, screen by screen behind isMobile(), the layouts that overflow when the floor is raised: the pause menu objective line into RESUME; character select's "Proctus covers as" over the quote; any others you find by walking every menu and dialogue screen with ?mobileread=1 at 844x390, 750x340 and 740x360.
   - Raise MIN_TEXT_CSS to 11 for labels.
   - Make reading text (dialogue body, choices, subtitles, TV captions, book and message reading) about 16 CSS px on phones. Re-flow or re-paginate the dialogue box as needed; the words stay identical.
   - Then flip readability's default to true in DEFAULT_PHONE_SETTINGS (stored player choices still win) and flip the smoke test's default check.
   - Every tap target in menus at least 44 CSS px (P14: the title's ADD TO HOME SCREEN button included).
2. Dialogue on phones:
   - Tap anywhere advances; a tap while a line is typing completes it.
   - Visible SKIP, LOG and AUTO pills, small and out of the way. SKIP fast-forwards to the next choice or the end of the conversation, applying every effect the skipped lines would have applied, and never skips a choice. LOG shows the lines already shown in this conversation, in a native-scroll list. AUTO advances after the voice line ends, or after a reading time.
   - Choices need a deliberate tap: ignore taps for 150 to 200 ms after they appear (S11).
   - The same pills work in meetings, vignettes and cutscenes that use dialogue. Keep the existing game rules, for example broadcasts the game makes you watch to the end.
   - Android Back in a conversation: decide between opening pause and closing an overlay, and say why (R3 follow-up).
   - Look at how a laptop player skips or advances today, and do not change that.
3. The Phone settings page (S12), reachable on phones from the title's settings and from the pause menu.
   - It renders phoneSettingsList(): two columns, 48 px rows, labels and one-line help.
   - Add a "Phone layout: Auto / On / Off" row using the flag's rememberPhoneMode(). Add a short line "A Bluetooth controller works".
   - Settings the combat builder is wiring (autoFire, aimAssist, phoneAssist) are in the list already. Render every row, live or not, and let the merge decide.
   - Another builder is adding a "CONTROLS" entry to the same pause menu in another worktree. Keep your hook minimal so the merge is easy, and say exactly what you changed.
4. Walking comfort: the idle stick ring must not sit over the player (750x340, Home far left). First-time cues for walking (S10): pulse the stick ring and ACTION the first time each matters.
5. Narrator control tips (hard rule 3's exception): swap them to touch wording on phones only; list each one.
6. Tests: unit tests for the dialogue pill logic and pagination. Smoke sections "dialogue" and "settings2": advance, complete-typing, SKIP to a choice, LOG, AUTO, choices ignore early taps, the phone settings page opens and every row works, text sizes measured with textSizes() (no reading text under 15 CSS px, no text under 11).
7. Walk every menu, dialogue and conversation type yourself on the iPhone profile by touch. Look at screenshots. Fix what looks wrong.

Verify before you finish: ${CHECK(5222)}
Update the README. Write ${REPORTS}/s2-03-ui-readability-dialogue.md: what changed per screen, every hook outside src/game/mobile and why, the narrator tips swapped, and the character lines that mention keys. Return the structured result.`,
  { label: 'menus: readability, dialogue, phone settings', phase: 'Build', schema: BUILD_SCHEMA })

const uiLists = (u1) => agent(`${CTX}
# Your role: MENUS AND DIALOGUE BUILDER, part 2 of 2: lists, shops, character select, the touch wording sweep
${RESUME_NOTE}
Worktree: ${UI_WT} (branch "mobile-ui"; work ONLY here). Vite ports: ${5222} and ALT ${5232}. Scratch: ${SP}/mobile/work/s2-ui2/.
Part 1 just made reading text comfortable, added dialogue SKIP/LOG/AUTO and the Phone settings page: read ${REPORTS}/s2-03-ui-readability-dialogue.md and the README first. Its summary:
${u1 ? u1.apiSummary : '(part 1 returned nothing: read its report and the git log)'}
Gaps part 1 left: ${JSON.stringify(u1 ? u1.gaps : [])}
A separate builder is doing combat controls and the HUD in another worktree: do not build those.

Build (research M10, S13, DEFERRED P16, and the touch wording sweep):
1. One native-scroll list (M10) for every list longer than the screen on phones:
   - the TV on-demand channel guide;
   - the gun rack;
   - shops and the Kreddle Exchange;
   - trophies, the wardrobe, the fridge;
   - Chapter Select, the TV log, and any others you find.
   Momentum scrolling, the scroller stops touches from reaching the game (stopPropagation on touch-start and touch-end), and the selected item stays visible. A list that already fits stays as it is.
2. Shops and inventory (S13): a tap selects an item and shows its detail with a separate BUY button. Quantities use plus and minus. Destructive or exit buttons (SAVE and QUIT, sell, discard) sit at least 12 px from anything else or ask to confirm. Buttons act on release. The gun rack's drag-to-reorder keeps a tap or arrow alternative (S11).
3. Character select (P16): on phones a tap selects and previews, and PLAY AS confirms. Laptops keep today's behaviour.
4. The touch wording sweep: every NON-dialogue UI string on phones that names a key or the mouse (E, Space, Esc, WASD, arrows, 1-5, "click", Q, Shift, Tab, and the rest) goes through hint()/touchWording with the right touch words. That covers menus, prompts, captions, meeting reaction hints (for example "REACT (1-5 or click)"), TV captions and on-screen instructions in walking scenes and menus.
   - The combat HUD's prompts belong to the other builder; minigame instructions are stage 3. List every minigame string you see, for stage 3.
   - Never dialogue (hard rule 3).
   - Produce the complete list of character dialogue lines that mention keys (file and line). The coordinator shows it to the user.
5. Tests: smoke section "lists": scroll each long list by touch, select, buy with plus and minus, reorder by the alternative. Character select tap-then-confirm. A wording check that walks the walking scenes and menus and fails on any visible key name outside dialogue.
6. Walk it all yourself on the iPhone profile by touch, and look at the screenshots.

Verify before you finish: ${CHECK(5222)}
Update the README. Write ${REPORTS}/s2-04-ui-lists-wording.md and return the structured result.`,
  { label: 'menus: lists, shops, wording sweep', phase: 'Build', schema: BUILD_SCHEMA })

const [combat, ui] = await parallel([
  async () => { const c1 = await combatTop(); log('Combat part 1: ' + (c1 ? (c1.commits || []).join(', ') : 'returned nothing')); const c2 = await combatSide(c1); return { c1, c2 } },
  async () => { const u1 = await uiRead(); log('Menus part 1: ' + (u1 ? (u1.commits || []).join(', ') : 'returned nothing')); const u2 = await uiLists(u1); return { u1, u2 } },
])
const builds = { c1: combat && combat.c1, c2: combat && combat.c2, u1: ui && ui.u1, u2: ui && ui.u2 }
const failed = Object.entries(builds).filter(([k, v]) => !v || !v.ok).map(([k]) => k)
if (failed.length) log('Build parts that did not finish cleanly: ' + failed.join(', ') + ' (the merge and reviewers will see their state)')

// ---------------------------------------------------------------- 2. Merge
phase('Merge')
const merge = await agent(`${CTX}
# Your role: MERGER (worktree ${WT}, branch "mobile"; Vite ports 5202 and ALT 5212; scratch ${SP}/mobile/work/s2-merge/)

Two tracks of stage 2 were built in parallel:
- Combat track, on branch "mobile" in ${WT}. Reports: ${REPORTS}/s2-01-combat-topdown.md and s2-02-combat-side.md.
- Menus and dialogue track, on branch "mobile-ui" in ${UI_WT}. Reports: ${REPORTS}/s2-03-ui-readability-dialogue.md and s2-04-ui-lists-wording.md.
Their structured results (summaries) are: ${JSON.stringify({ c1: builds.c1 && { ok: builds.c1.ok, commits: builds.c1.commits, gaps: builds.c1.gaps }, c2: builds.c2 && { ok: builds.c2.ok, commits: builds.c2.commits, gaps: builds.c2.gaps }, u1: builds.u1 && { ok: builds.u1.ok, commits: builds.u1.commits, gaps: builds.u1.gaps }, u2: builds.u2 && { ok: builds.u2.ok, commits: builds.u2.commits, gaps: builds.u2.gaps } })}

Merge "mobile-ui" into "mobile" in ${WT} with a merge commit ("git merge mobile-ui"; do not rebase). Resolve every conflict by keeping BOTH tracks' behaviour: the pause menu gets both PHONE SETTINGS and CONTROLS; the README gets both sections; the smoke test keeps every section; the settings list keeps every row with the combat track's live flags.
Then make the two tracks work together:
- With readability ON (the new default), check the combat HUD, the weapon chip, the picker, the Controls picture and the specials-ready prompts. Fix overflow behind isMobile().
- The combat HUD prompts use the same touch wording table as the sweep.
- The Phone settings page changes the combat settings live in a fight.
- The dialogue pills and the combat layer never show at once.
Read both tracks' code where they meet (touchLayer, modes, settings, UIScene, MenuScene, wording).
Play by touch on the iPhone profile: boot, new game, Home, a conversation with SKIP and LOG, the Hub, the Phone settings page, a top-down room, a side room with jumps, the Krezz Arms brawl, the pause menu's Controls picture.

Verify: ${CHECK(5202)}
Commit the merge and any fixes, with the required footer. Leave the worktree clean. Write ${REPORTS}/s2-05-merge.md and return the structured result.`,
  { label: 'merge tracks and re-check', phase: 'Merge', schema: MERGE_SCHEMA })
if (!merge || !merge.ok) {
  log('Merge did not finish cleanly; continuing to review so the problems are found and fixed')
}

// ---------------------------------------------------------------- 3. Review (diverse lenses)
phase('Review')
const REVIEW_RULES = `
You are a REVIEWER. Do not edit any file in the worktree ${WT} and do not commit. Scratch scripts and screenshots go under your scratch folder only. Report real, specific, reproducible problems; do not pad the list. For each finding give:
- an id (prefix given below);
- a severity: blocker = cannot progress, or the laptop or another non-phone device is affected; major = painful, confusing or wrong; minor = cosmetic;
- where it is, how to reproduce it, and a suggested fix.
Set affectsLaptop true only when a non-phone device is affected.
Stage 2 is now on branch "mobile" in ${WT}. Stage 1 is the commit range up to e8cf3f4f; everything after it is stage 2.`

const lenses = [
  { key: 'laptop', label: 'review: laptop unchanged', prompt: `${CTX}
# Your role: LAPTOP-UNCHANGED REFUTER (Vite ports 5203 and ALT 5213; scratch ${SP}/mobile/work/s2-review-laptop/; finding id prefix "L")
${REVIEW_RULES}

The claim to attack: "on a laptop, and on any device that is not a phone, the game is exactly as it was before". Stage 2 added guarded hooks INSIDE game logic: Controls, UIScene's HUD, the side-scroller physics (jump buffer, coyote, variable height, ledge forgiveness), pickups, aim, dialogue, menus, shops, character select, the pause menu. REFUTE the claim. Assume it is false until you fail to break it.
- Read "git diff e8cf3f4f..HEAD" for EVERY file outside src/game/mobile/, line by line. Is every changed line a guarded hook, an import of flag.ts, or test or tool code? Does any guard change order of execution, object creation, timing, random-number consumption, tween or timer creation, or saved data on a laptop? A hook that creates an object, calls RNG or registers a listener before checking isMobile() is a finding.
- Check that laptops still never fetch the phone chunk (production build, network log), and that the main chunk grew only by the hooks.
- Run every check yourself: ${CHECK(5203)}
- Judge the safety net's blind spots for THIS stage: jump feel at other frame rates, pickups radius, dialogue skip keys, shop input, character select by mouse, the gun rack drag. Probe each directly on a laptop profile against a base-source server: check out e8cf3f4f in a throwaway worktree under your scratch folder, hard-link node_modules with "cp -al", and remove it afterwards.
- Do the same for the touchscreen laptop, iPad and Android tablet profiles: today's old pad and today's menus.
Return every difference, however small.` },
  { key: 'player', label: 'review: blind first-time player', prompt: `${CTX}
# Your role: BLIND FIRST-TIME PHONE PLAYER (Vite port 5204; scratch ${SP}/mobile/work/s2-review-player/; screenshots to ${SP}/mobile/shots/s2-review-player/; finding id prefix "P")
${REVIEW_RULES}

Do NOT read the builders' reports before playing: judge what a player gets. You may read src/game/mobile/README.md only AFTER your first full play-through.
You are a friend of the developer, opening the link on an iPhone held sideways, never having played. The user wants the phone version to be "mega intuitive and fun".
Play by real touch events only on the iPhone 14 landscape profile (with its safe-area insets), and spot-check 750x340, 740x360 and 932x430:
1. Boot, the Add to Home Screen guide, new game, character select, difficulty, banter, Home. Read and skip conversations: is the text comfortable to read, and is SKIP, LOG and AUTO obvious?
2. The Hub, two interiors, a shop (buy something), the gun rack, the TV guide, the pause menu, the Phone settings page and the Controls picture.
3. Reach the first dungeon the way a player would (or with DebugSkip, saying so). Fight several rooms and a boss with no instructions. Did you know what to press? Did auto-fire and the aim ring make sense? Could you dodge, swap, use a special, heal? Did anything cover the enemies or the player?
4. A side-scrolling room (DebugSkip: Crobley or the SanMik Zone): jump across gaps, onto moving platforms, through drop-through floors. Did any jump feel awkward? Did you fall through by accident?
5. The Krezz Arms brawl and a Kreltality or other finisher.
Record, for each step, the time taken and every moment of confusion. Measure text sizes (CSS px), control sizes, spacing, and how much of the play area the controls cover. Return every problem a real player would hit, with severity and a screenshot path.` },
  { key: 'feel', label: 'review: combat and jumping feel', prompt: `${CTX}
# Your role: COMBAT AND JUMPING FEEL TESTER (Vite port 5205; scratch ${SP}/mobile/work/s2-review-feel/; finding id prefix "F")
${REVIEW_RULES}

You test whether phone combat and jumping FEEL right, against the research's numbers ("Jumping (detailed)", layout v2, section 4, M1, M2, M3, M5, M6, S11). Read those first, then the README's combat sections. Measure with a fake clock and real touch events (CDP), at 30, 60 and 120 Hz where timing matters:
- Touch-down to action latency for FIRE, DODGE and JUMP (frames).
- The jump buffer (150 ms) and coyote (140 ms) windows; hop vs full height (about 78 / 145 px).
- Drop-through only on a deliberate input. Ledge forgiveness and corner correction. Camera lead. Stick x-only in side rooms (full speed at 35%).
- Auto-fire: only at enemies with a clear line; never at barrels, never a special, never with an overlay open; the 200 ms grace when auto-fire is off; all eight guns; the auto-switch when empty; never delays a jump or dodge.
- Aim: sticky target, the stick bias, the fallback to objects, the 24 px slide threshold, the 15 degree snap, the visible ring.
- Gap routing within 20 px; hit slop; touch-down actions; holds at 300 ms with the 12 px cancel; pop-in controls ignore presses for 150 to 200 ms.
- Multi-touch with three fingers (stick + FIRE + DODGE, stick + JUMP + FIRE); a fourth and fifth finger.
- Every control inside the safe insets with the Dynamic Island band clear; spacing of at least 12 px; the height clamp at 340 and 320 px tall.
- The brawl: punch latency, mash and quick-time windows.
- Laptop comparison: the same jump on a laptop profile must give exactly the laptop's arc. Phone-only forgiveness must not leak.
Report each number measured against its target, and every deviation that a player would feel.` },
  { key: 'robust', label: 'review: robustness and code', prompt: `${CTX}
# Your role: ROBUSTNESS AND CODE REVIEWER (Vite port 5208 if you need one; scratch ${SP}/mobile/work/s2-review-robust/; finding id prefix "R")
${REVIEW_RULES}

Review stage 2's code, everything after e8cf3f4f, the way a senior engineer who has shipped mobile web games would. Look for real defects, each with a failing scenario:
- Stuck or dropped inputs across mode changes, scene shutdowns, deaths, room transitions, boss phase changes, the pause menu, the rotate overlay, hidden pages and touchcancel.
- Controllers that keep state across scenes.
- Aim and fire state leaking into the next room.
- The pad handover.
- Listeners and timers per scene that are never removed.
- Per-frame cost in combat on a mid-range phone (allocations per frame, DOM writes that are not transforms, layout thrash).
- The readability floor re-applying on resize.
- Dialogue SKIP skipping effects or choices. LOG memory growth.
- Native scrollers leaking touches to the game.
- Shop double-buys from a double tap.
- The wording table ever reaching dialogue: test it against every dialogue file.
- Settings changed mid-fight.
- The ALT build.
Also judge the tests: what could regress silently, and which assertions are vacuous?
Return only findings you can back with a concrete scenario.` },
]

const reviews = await parallel(lenses.map(l => () => agent(l.prompt, { label: l.label, phase: 'Review', schema: FINDINGS_SCHEMA })))
let findings = []
reviews.forEach((r, i) => { if (r && r.findings) for (const f of r.findings) findings.push({ ...f, lens: lenses[i].key }) })
const missing = lenses.filter((l, i) => !reviews[i]).map(l => l.key)
if (missing.length) log('Reviewers that returned nothing: ' + missing.join(', '))
log(`Review found ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blockers, ${findings.filter(f => f.affectsLaptop).length} affecting a non-phone device)`)

// ---------------------------------------------------------------- 4. Fix, then gate (loop)
const fixPrompt = (list, round) => `${CTX}
# Your role: FIXER, stage 2 round ${round} (worktree ${WT}; Vite ports 5206 and ALT 5216; scratch ${SP}/mobile/work/s2-fix${round}/)

Independent reviewers examined stage 2 on branch "mobile". Read src/game/mobile/README.md and the s2-* reports in ${REPORTS}/ first. Their findings are below as JSON.
Reviewers can be wrong. For EACH finding, first confirm it is real: read the code, and reproduce it on an emulated phone or laptop as appropriate. Then:
- Real: fix the root cause, not the symptom, and add or extend a test that would have caught it where practical.
- Not real: reject it with the evidence.
- Real but belongs to stage 3 (minigames and special scenes, audio, memory, performance) or stage 4 (device-only QA): defer it, and append it to ${REPORTS}/DEFERRED.md under that stage.
Anything with affectsLaptop true must be fixed now or disproved with evidence; it can never be deferred. Blockers must be fixed now. Majors about combat, jumping, readability or dialogue are this stage's job: fix them.

After fixing: ${CHECK(5206)}
Commit with the required footer and leave the worktree clean. Update the README where behaviour changed. Write ${REPORTS}/s2-06-fix-round${round}.md.

Findings:
${JSON.stringify(list, null, 1)}`

const gatePrompt = (round) => `${CTX}
# Your role: FINAL GATE, stage 2 round ${round} (worktree ${WT}; Vite ports 5207 and ALT 5217; scratch ${SP}/mobile/work/s2-gate${round}/)

You decide whether stage 2 (branch "mobile") is safe to publish to the live game. You are independent: trust nothing in the reports, run everything yourself. Do not edit game code. If a check script is itself broken, say so as a blocker; do not fix it.

1. Laptop: ${CHECK(5207)}
   - Read the diff of every file outside src/game/mobile/ since e8cf3f4f. Every changed line must be a guarded hook, an import or tooling.
   - Play the laptop version for three minutes with keyboard and mouse: title, new game, character select by mouse, Home, Hub, a shop, a conversation, a dungeon room, a side-scrolling room with jumps, pause. Anything different from before is a blocker. Use a base-source server from e8cf3f4f in a throwaway worktree for comparison, and remove it afterwards.
2. Both production builds ("npx vite build --outDir <temp>" and the same with VITE_KREL_ALT=1) succeed; delete the output. A laptop boot of the production build does not request the phone chunk.
3. Phone, iPhone 14 landscape with insets and a small Android, real touch events:
   - the smoke test passes;
   - then play by touch yourself: boot, guide, new game, Home with a conversation (SKIP and LOG), Hub, a shop, the Phone settings page, a top-down room and a boss, a side room with jumps, the Krezz Arms brawl, pause and the Controls picture, rotate and hidden mid-fight.
   - No stuck inputs, no dead controls, no unreachable step, no reading text under 15 CSS px, no control under 44 CSS px, nothing interactive in the bottom 21 px.
   - "?mobile=0" on a phone behaves like the laptop game.
4. The worktree is clean. Every new commit message ends with the required two footer lines, and no file or commit carries a model name outside that footer or the user's email.
pass = true only if every non-phone device is provably unchanged AND a phone player can boot, read, fight, jump and get around without a blocker.
Return blockers with exact reproduction. Write ${REPORTS}/s2-07-gate-round${round}.md.`

let fix = null
if (findings.length) {
  phase('Fix')
  fix = await agent(fixPrompt(findings, 1), { label: 'fix review findings', phase: 'Fix', schema: FIX_SCHEMA })
}
phase('Gate')
let gate = await agent(gatePrompt(1), { label: 'final gate', phase: 'Gate', schema: GATE_SCHEMA })
let round = 1
const fixes = [fix]
while (gate && !gate.pass && round < 3) {
  round++
  log(`Gate round ${round - 1} failed with ${gate.blockers.length} blockers; fixing`)
  const f = await agent(fixPrompt(gate.blockers.map(b => ({ ...b, severity: 'blocker', lens: 'gate' })), round), { label: `fix gate blockers (round ${round})`, phase: 'Fix', schema: FIX_SCHEMA })
  fixes.push(f)
  gate = await agent(gatePrompt(round), { label: `final gate (round ${round})`, phase: 'Gate', schema: GATE_SCHEMA })
}

return { stage: 'stage2', builds, merge, findings, fixes, gate, rounds: round }

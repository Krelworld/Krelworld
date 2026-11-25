export const meta = {
  name: 'krelworld-mobile-stage3-wave1',
  description: 'KRELWORLD phone stage 3 wave 1: tap things to use them everywhere, and iPhone audio, memory, performance, saves, caching and pause routes; then merge, review, fix and gate',
  phases: [
    { title: 'Build', detail: 'two tracks in parallel: tap-to-use, and platform (audio, memory, performance)' },
    { title: 'Merge', detail: 'merge both tracks and the latest phone branch' },
    { title: 'Review', detail: 'laptop refuter, blind phone player, robustness and performance' },
    { title: 'Fix', detail: 'fix confirmed findings' },
    { title: 'Gate', detail: 'final laptop and phone checks' },
  ],
}
const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const UI_WT = SP + '/mobile-ui-wt'
const TWT = SP + '/s3-tap-wt'
const PWT = SP + '/s3-perf-wt'
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
- Stage 1 (phone flag, shell, walking controls, settings, guide) and stage 2 (fight and jump controls, phone HUD, dialogue SKIP/LOG/AUTO, readability on, thumb-scroll lists, shops, touch wording, decluttered fight screen) are LIVE (live branch claude/krelworld-game at 37a710d4; local branch "mobile" in ${WT}).
- A separate agent is finishing the user's stage 2 feedback (the stick stays where the thumb lands, jumping feel, big buttons for ready specials, pause everywhere) on branch "mobile-feel" (worktree ${SP}/mobile-feel-wt). When it passes, the coordinator merges it into "mobile". Do not touch that worktree.
- THIS workflow is stage 3, wave 1: TAP-TO-USE everywhere (the user's top priority) and the phone platform work (iPhone audio, memory, performance, saves, caching, pause for minigames). Wave 2 (later) is every minigame and special scene by touch, Night of Freedom manual aim, TV subtitles. Stage 4 is full QA.
- Required reading item 4 also includes the stage 2 reports s2-01..s2-11 that exist in ${REPORTS}/ (skim what concerns you) and ${REPORTS}/DEFERRED.md's two "Stage 3" sections.

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


const SPEED = `
## Working fast (the user asked for speed; quality rules still apply)
- The full CHECK takes a long time on this machine: during your work run only tsc, the unit tests you touch, and the smoke sections that cover your area; run the FULL check once at the end (and again only if you then change game code).
- Use a fake clock and deterministic stepping for measurements instead of real-time waiting where possible.
- Keep your report short and factual. Commit in small working steps (usage may run out at any time; an interrupted re-run continues from your commits and report).`

phase('Build')
const tap = () => agent(`${CTX}${SPEED}

# Your role: TAP TO USE (worktree ${TWT}, branch "s3-tap"; dev ports 5302 / ALT 5312; scratch ${SP}/mobile/work/s3-tap/; screenshots ${SP}/mobile/shots/s3-tap/; report ${REPORTS}/s3-01-tap.md)

The user, verbatim: "on the phone I think like, you should consider areas where you can tap environmental things to interact with them in addition to being able to walk up to them. Seems like being able, to example, to touch things at home should allow you to interact with them". This is the TOP PRIORITY of stage 3. Read the DEFERRED.md item "Tap the thing to use it, from anywhere" and the "P5 remainder" item.

Build, phones only:
1. In EVERY walking scene (Home first, then the Hub/Krelford town, every interior, the Club, the Venue, Kreddle, Polson Towers / PolsonHome, the Pub, the Pit, the Lair and any other scene where you walk about and use things), tapping any interactable thing or person (the telly, the book, the gun rack, the wardrobe, the fridge, the laptop, the console, the bed, trophies, doors and exits, NPCs, shop counters, machines...) walks the player there by itself and then uses it, like a point-and-click game. If the player is already in reach, it is used straight away.
2. Walking: use the scene's own movement (the same speed and collisions as walking with the stick). Find a route around furniture and walls (a simple grid path-finder over the scene's colliders is fine); if there is no route, walk as close as possible and show the prompt. Never teleport. Moving the stick cancels the walk at once. A second tap on another thing re-targets. A conversation, menu or cutscene starting cancels it.
3. Feedback: a small highlight or ring on the tapped thing straight away (within one frame), and a light marker at the destination; the name of the thing (the prompt's own wording) in the bubble as today.
4. Tap areas at least 44 CSS px on small things; when two things overlap, the one nearest the tap point wins; the player character and the HUD never steal the tap. Taps on empty floor: walk there (it felt right in research for point-and-click; if it makes stray taps annoying in testing, make it do nothing, and say which you chose and why).
5. Close the P5 remainder: the Club, the Venue and Kreddle's people get their promptTarget adapters.
6. Keep the stage 1/2 behaviour that already works (tap the prompt bubble = ACTION, the ACTION button, the stick zone's taps). The stick zone stays the stick: a touch that moves there is the stick; a still tap there on a thing uses it.
7. The narrator tip on phones already says "Tap things to use them" (stage 2 N6): after this it is true everywhere. Check every phone-only touch wording line about using things still matches.
Tests: unit tests for the path-finder and target picking; a smoke section "tapuse" that, on the iPhone profile, taps the telly, the book and the gun rack at Home from the far side of the room, a door in the Hub, an NPC in the Hub, and a person in the Club or Kreddle, and asserts each opens; also that the stick cancels a walk. Laptop: nothing changes (no hooks that run on a laptop).
At the end, the FULL check: ${CHECK(5302)}
Write the report. Return JSON per the build schema.`, { label: 'tap: tap things to use them', phase: 'Build', schema: BUILD_SCHEMA })

const perf = () => agent(`${CTX}${SPEED}

# Your role: PHONE PLATFORM: audio, memory, performance, saves, caching, pause routes (worktree ${PWT}, branch "s3-perf"; dev ports 5322 / ALT 5332; scratch ${SP}/mobile/work/s3-perf/; screenshots ${SP}/mobile/shots/s3-perf/; report ${REPORTS}/s3-02-platform.md)

Read the research's M9 (audio), M12 (memory), S7 (saves), S14 (download/caching) and the audit's section 6 (performance plan), and DEFERRED.md's stage 3 items (P7 remainder, minigames and the finale have no pause route). The device checklist ${SP}/mobile/DEVICE_CHECKLIST.md shows what the user will test on a real iPhone.

Build, phones only:
1. AUDIO (iPhone Safari is the target): sound must start on the first tap; resume after the phone is locked and unlocked, after a call or Siri, and after switching apps; the Music and Effects volume settings must actually work on iPhone (iOS ignores the volume of HTML <audio> elements, so any music, song or voice played through <audio> must be routed through Web Audio gain nodes, or played in a way that obeys the setting); no double music after resuming; no audio context left suspended. Voices must play. Rhythm songs (crocodile, Cam2Cam) must start in sync from a tap. Write a small audio diagnostic into ?mobilediag (context state, active sources, last resume reason). Verify what you can in Chromium emulation, and list what only a real iPhone can confirm.
2. MEMORY: the game holds about 900 MB of decoded textures; iPhones kill a tab at about 1.5-2 GB total, older iPhones earlier. Measure texture memory per scene on the phone profile (the diag line), find what is loaded up front versus needed, and cut the phone's peak substantially (target: under 500 MB in normal play), e.g. load scene art on demand and release it when leaving, never keep every chapter's art resident, release TV show art after a show, keep only what the next scene needs. Laptops must load exactly as before (no change in their load order, timing or what they keep). No changes to the art files themselves, index.html, main.ts's scene list, the Phaser config or vite.config. Report the before/after peak and per-scene numbers.
3. PERFORMANCE: the heaviest scenes (the Hoard boss, the concept boss krelford_finale at 20 fps in emulation, dense rooms) on phones: cap effects/particles/corpses on phones, no camera zoom below 1.0 on phones in the concept boss (the audit's finding), a player marker ring where the player is hard to see. Measure fps before/after on the phone profile with CPU throttling 4x.
4. SAVES (S7) and caching (S14): phones lose saves when Safari clears storage or between Safari and the Home Screen app; make sure saves are written at safe moments (after each room, on page hide), consider navigator.storage.persist() on phones, and show nothing scary. Caching: assets fetched once per session at most; check repeat visits do not re-download everything (service worker only if it is safe for laptops; laptops must not get one: if a service worker can't be made phone-only safely, skip it and say why).
5. PAUSE ROUTES: every minigame and the finale gets a way to pause on phones (a pause button that opens the game's own pause or the shell's carry-on card), so coming back after the phone was locked opens a pause instead of the carry-on card (wakeCare). Keep it generic so wave 2's minigame work can reuse it.
6. The in-app browser (P7 remainder): consider holding the heavy load until PLAY HERE ANYWAY.
Tests: unit tests where logic is pure; a smoke section "platform" (audio resume after a hidden page, volume setting reaching music, a texture-memory ceiling check across a scripted walk through several scenes, pause in a minigame). Laptop: nothing changes; the fingerprint must stay identical.
At the end, the FULL check: ${CHECK(5322)}
Write the report. Return JSON per the build schema.`, { label: 'platform: audio, memory, perf', phase: 'Build', schema: BUILD_SCHEMA })

const [t, p] = await parallel([tap, perf])
log(`Builds: tap ${t && t.ok}, platform ${p && p.ok}`)

phase('Merge')
const merge = await agent(`${CTX}${SPEED}

# Your role: MERGE stage 3 wave 1 (worktree ${TWT}, branch "s3-tap"; dev ports 5302 / 5312; report ${REPORTS}/s3-03-merge.md)
Two tracks were built in parallel from "mobile" at 37a710d4: "s3-tap" (tap to use; report s3-01-tap.md) and "s3-perf" (audio, memory, performance, saves, caching, pause routes; report s3-02-platform.md). In ${TWT}:
1. "git merge mobile" first (the local branch "mobile" may by now contain the user's stage 2 feedback fixes from "mobile-feel"; if "mobile" has not moved, nothing to do). Then "git merge s3-perf". Resolve conflicts keeping both sides' behaviour. No rebase.
2. Integration checks on the iPhone profile: tap-to-use still works with memory release on scene changes (art released and reloaded correctly when you walk back into a scene); audio resumes after hide while a tapped walk is in progress; pause routes work; the stick (whatever its current default) cancels a tapped walk.
3. The FULL check: ${CHECK(5302)}
Commit (footer), worktree clean, nothing pushed. Return JSON per the merge schema.`, { label: 'merge wave 1', phase: 'Merge', schema: MERGE_SCHEMA })

const RULES = `
You are a REVIEWER. Do not edit any file in ${TWT} and do not commit. Scratch and screenshots under your own folders. Report real, specific, reproducible problems only, each with: id (prefix below), severity (blocker = cannot progress, data loss, crash, or any non-phone device affected; major = painful, confusing or wrong; minor = cosmetic), where, repro, suggested fix. affectsLaptop true only if a non-phone device is affected.
Stage 3 wave 1 is on branch "s3-tap" in ${TWT}: everything after 37a710d4 (plus whatever came from "mobile").`
const lenses = [
  { key: 'laptop', label: 'review: laptop unchanged', prompt: `${CTX}${SPEED}
# Your role: LAPTOP-UNCHANGED REFUTER (ports 5303 / 5313; scratch ${SP}/mobile/work/s3-review-laptop/; prefix "L")
${RULES}
Claim to attack: on laptops and every non-phone device, the game is exactly as before. This wave touched asset LOADING and RELEASE, AUDIO routing, saves and pause: areas the fingerprint may not see. Read every changed line outside src/game/mobile/ (git diff 37a710d4..HEAD). A load-order change, a texture released or loaded at a different time, an audio node graph change, a save written at a new moment, a storage.persist call, a service worker, or any listener registered before an isMobile() check on a laptop is a finding. Check the production build's network log on a laptop boot against the base (37a710d4 in a throwaway worktree with cp -al node_modules; remove it after): same requests, same order, same audio behaviour. Then run: ${CHECK(5303)}` },
  { key: 'player', label: 'review: blind phone player', prompt: `${CTX}${SPEED}
# Your role: BLIND FIRST-TIME PHONE PLAYER (port 5304; scratch ${SP}/mobile/work/s3-review-player/; screenshots ${SP}/mobile/shots/s3-review-player/; prefix "P")
${RULES}
Do not read the reports before playing. iPhone 14 landscape with insets, real touch events; spot-check 740x360. Play as a friend opening the link: Home (tap the telly, the book, the gun rack, the wardrobe, the fridge, the door, from across the room), the Hub (tap doors, people, shops), several interiors, the Club, the Venue, Kreddle, the Pub, Polson's. Does tapping things feel natural, quick and predictable? Any stray walks, wrong targets, stuck walks, things that can't be tapped? Then: lock/unlock (page hidden) mid-walk and mid-minigame: does it pause and resume cleanly with sound? Play 15 minutes moving between many scenes: any slow-down, reloads, missing art? Report with times and screenshots.` },
  { key: 'robust', label: 'review: robustness, memory, audio', prompt: `${CTX}${SPEED}
# Your role: ROBUSTNESS, MEMORY AND AUDIO REVIEWER (port 5305; scratch ${SP}/mobile/work/s3-review-robust/; prefix "R")
${RULES}
Review the wave's code like a senior mobile web engineer. Find real defects with a failing scenario: textures released while still in use (missing art, black boxes, crashes on scene re-entry, TV shows, cutscenes, saves loaded mid-chapter, DebugSkip jumps), memory that still grows across a long session (walk through 20+ scene changes and measure the texture total and JS heap), audio contexts or sources leaking, double music, music ignoring the volume setting, path-finder hangs or per-frame cost, tapped walks into doors that change scene, re-targeting races, saves written mid-transition or corrupted, pause routes leaving inputs stuck. Judge the tests: which assertions are vacuous?` },
]

const reviews = await parallel(lenses.map(l => () => agent(l.prompt, { label: l.label, phase: 'Review', schema: FINDINGS_SCHEMA })))
let findings = []
reviews.forEach((r, i) => { if (r && r.findings) for (const f of r.findings) findings.push({ ...f, lens: lenses[i].key }) })
log(`Review: ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blockers, ${findings.filter(f => f.affectsLaptop).length} non-phone)`)

const fixPrompt = (list, round) => `${CTX}${SPEED}
# Your role: FIXER, stage 3 wave 1 round ${round} (worktree ${TWT}; ports 5306 / 5316; scratch ${SP}/mobile/work/s3-fix${round}/; report ${REPORTS}/s3-04-fix-round${round}.md)
If the report already exists, an earlier run was cut off: continue from it and the git log.
Reviewers can be wrong: confirm each finding (code + reproduction) first. Real: fix the root cause and add a test where practical. Not real: reject with evidence. Belongs to wave 2 (minigames by touch, Night of Freedom aim, TV subtitles) or stage 4 (device-only): defer it into ${REPORTS}/DEFERRED.md. affectsLaptop findings and blockers are fixed now or disproved; never deferred. Majors in tap-to-use, audio, memory and saves are this wave's job.
Then: ${CHECK(5306)}
Commit (footer), worktree clean, README updated where behaviour changed.
Findings:
${JSON.stringify(list, null, 1)}`

const gatePrompt = (round) => `${CTX}${SPEED}
# Your role: FINAL GATE, stage 3 wave 1 round ${round} (worktree ${TWT}; ports 5307 / 5317; scratch ${SP}/mobile/work/s3-gate${round}/; report ${REPORTS}/s3-05-gate-round${round}.md)
Decide whether branch "s3-tap" is safe to publish. Trust nothing; run everything yourself; do not edit game code.
1. ${CHECK(5307)}
   Read every changed line outside src/game/mobile/ since 37a710d4: guarded hooks, imports or tooling only. Play the laptop for 3 minutes (title, new game, Home, Hub, an interior, a shop, a dungeon room, TV, pause) against a base server from 37a710d4 in a throwaway worktree (remove it after): no difference, same network requests on boot.
2. Production builds main and ALT succeed (temp folder, deleted); a laptop boot never requests the phone chunk.
3. Phone (iPhone 14 with insets, 740x360), real touch: smoke passes; tap-to-use at Home, Hub, an interior, the Club or Kreddle; a dungeon fight and a side room still work; lock/unlock mid-walk and mid-minigame resumes with sound and a pause; a 15-scene walk keeps texture memory under the stated ceiling; ?mobile=0 behaves like the laptop.
4. Clean worktree; every new commit ends with the two footer lines; no model name or email anywhere else.
pass = true only if non-phone devices are provably unchanged and a phone player has no blocker.`

let fix = null
if (findings.length) { phase('Fix'); fix = await agent(fixPrompt(findings, 1), { label: 'fix review findings', phase: 'Fix', schema: FIX_SCHEMA }) }
phase('Gate')
let gate = await agent(gatePrompt(1), { label: 'final gate', phase: 'Gate', schema: GATE_SCHEMA })
let round = 1
const fixes = [fix]
while (gate && !gate.pass && round < 3) {
  round++
  const f = await agent(fixPrompt(gate.blockers.map(b => ({ ...b, severity: 'blocker', lens: 'gate' })), round), { label: `fix gate blockers (round ${round})`, phase: 'Fix', schema: FIX_SCHEMA })
  fixes.push(f)
  gate = await agent(gatePrompt(round), { label: `final gate (round ${round})`, phase: 'Gate', schema: GATE_SCHEMA })
}
return { stage: 'stage3-wave1', builds: { tap: t, perf: p }, merge, findings, fixes, gate, rounds: round }

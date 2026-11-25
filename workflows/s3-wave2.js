export const meta = {
  name: 'krelworld-mobile-stage3-wave2',
  description: 'KRELWORLD phone stage 3 wave 2: every minigame and special scene by touch, the phone sound mix, TV subtitles; then merge, review, fix and gate',
  phases: [
    { title: 'Build', detail: 'two tracks in parallel: minigames by touch, and special scenes / aiming / driving / TV; then the phone sound mix' },
    { title: 'Merge', detail: 'merge both tracks' },
    { title: 'Review', detail: 'laptop refuter, blind phone player, minigame robustness' },
    { title: 'Fix', detail: 'fix confirmed findings' },
    { title: 'Gate', detail: 'final laptop and phone checks' },
  ],
}
const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const UI_WT = SP + '/mobile-ui-wt'
const TWT = SP + '/s3-tap-wt'
const PWT = SP + '/s3-perf-wt'
const GWT = SP + '/s3-games-wt'
const SWT = SP + '/s3-scenes-wt'
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
- LIVE (branch claude/krelworld-game at 496f1066; local branch "mobile" in ${WT}): stage 1 (phone flag, shell, walking controls, settings, guide), stage 2 (fight and jump controls, phone HUD, dialogue SKIP/LOG/AUTO, readability, thumb-scroll lists, shops, touch wording, calm fight screen) and the user's thumb-feel round (the stick stays where the thumb lands, a quick JUMP tap clears platforms, specials and drinks are 60 px "pocket" buttons on the right, pause everywhere).
- Stage 3 WAVE 1 (another workflow, still in review on branch "s3-tap" in ${TWT}; do not touch that worktree): tap-to-use in every walking scene, and the phone platform: iPhone audio routing (songs and voices through Web Audio gain via a pooled <audio> route in src/game/mobile/audio.ts), texture parking (art.ts), frame-rate caps (perf.ts), saves (storage.ts), and generic PAUSE ROUTES for minigames and the finale (read the README's "Stage 3: the phone platform" section and ${REPORTS}/s3-01-tap.md, s3-02-platform.md: reuse those pause routes, do not build your own).
- THIS workflow is stage 3 WAVE 2: every minigame and special scene playable by touch, plus the user's audio feedback. Your worktree starts at 68584994 = wave 1's two builds merged + the thumb-feel round (wave 1's review fixes will be merged in later by the coordinator).
- Stage 4 (later) is full QA and the final publish.
- The user's decisions for this wave (verbatim where quoted):
  * Scope, "Safe cut": four OPTIONAL extras get only a simple phone treatment (tap-to-play, or a clear SKIP that counts as a normal finish without blocking anything; laptop unchanged): the Gig (Krebon's optional story), Boggor's photo quest, the home games console replays, and the Kreddle Pit IF it is optional (check the code: if the story requires it, it gets full touch controls). EVERY other minigame, including ones only one character plays (RuneScape, Deadlift, Girlfriends, Renovate, Burpees, Modulator/Facebook), gets proper, fun touch controls.
  * Jumping: the JUMP button only; never jump by pushing the stick up.
  * Audio: "Speech and sound effects are a little quiet on phones."
- Read ${REPORTS}/DEFERRED.md's "Stage 3" sections and the audit's minigame sections; wave 1 left minigames, Night of Freedom aim and TV subtitles (P5) to you.

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
- 4 CPUs, 15 GB RAM, about 8 GB disk free. Up to three other agents run at the same time as you (heavy load: expect slowness; never treat a timing failure under load as proof of a bug without re-running it once).
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



const SPEED = `
## Working fast (the user asked for speed; quality rules still apply)
- The full CHECK takes a long time on this machine: during your work run only tsc, the unit tests you touch, and the smoke sections that cover your area; run the FULL check once at the end (and again only if you then change game code).
- Use a fake clock and deterministic stepping for measurements instead of real-time waiting where possible.
- Keep your report short and factual. Commit in small working steps (usage may run out at any time; an interrupted re-run continues from your commits and report).`

const COMMON = `
## How every touch scheme must work (both tracks)
- First MAP your scope from the code: every scene, mode and input it reads (keys, mouse, pointer, pad), how it is entered (DebugSkip/goArc/flags), win/lose/exit, and what a phone shows today (screenshot each at 844x390 with insets). The scope lists below are a starting point, not complete: anything in your area you find that is unplayable by touch is yours too.
- Then give each one a touch scheme that a first-time phone player understands in two seconds and that is FUN, not just possible: big targets (60 px+ drawn, 44 px+ hit) under the thumbs, nothing important under a thumb, the right thumb for the main action, the left for movement or a second action, a short first-time cue in touch words (system/narrator UI text only; never dialogue), the same difficulty and pacing as the laptop (do not make anything harder on a phone; small phone-only assists are fine and must be listed).
- Rhythm games: lanes are tapped where they are drawn (or big lane pads at the bottom), with an input-latency offset measured on the phone path; misses and hits judged exactly as on the laptop otherwise.
- Mashers: tapping anywhere on a big pad counts; holding is never needed for a masher.
- Prefer driving the game through its existing input (the touch layer's mode/controller API, legacyPad, injectTap, synthetic key state) over editing scenes. Existing game files only get small guarded hooks (isMobile()).
- Every minigame: works with the wave 1 pause route (lock/unlock mid-game resumes paused), can't softlock, the result and rewards are the laptop's, ESC-style exits have a touch way out where the laptop has one.
- Record per scene in your report: the scheme, why, and before/after screenshots (1x, a few each). Add a smoke section for your track and unit tests for pure logic.
`

const games = () => agent(`${CTX}${SPEED}${COMMON}

# Your role: TRACK A, MINIGAMES BY TOUCH (worktree ${GWT}, branch "s3-games"; dev ports 5502 / ALT 5512; scratch ${SP}/mobile/work/s3-games/; screenshots ${SP}/mobile/shots/s3-games/; report ${REPORTS}/s3-06-games.md)
Scope (map and complete it): MinigameScene's modes (bully, deadlift, girlfriends, renovate, runescape (scenes/minigame/runescape.ts), burpees, facebook/modulator, crocodile rhythm, gig / gigWatch); the Cam2Cam acapella rhythm section (4 lanes) and its undress stages; Flip It; the golden juice squeeze (systems/squeeze.ts); the Wonky Pole club's interactive bits (ClubScene, ClubCloseup); KrelCueScene (a Kreltality offered mid-script); Polson's restaurant bulking (dressing/polson.ts, PolsonHomeScene); the Kreddle Pit (PitScene, PitLoanScene); WhackScene and KrunchBurn in scenes/kreddle; any tap / mash / QTE prompt that names a key. Safe-cut items (Gig, Boggor's photos, console replays, the Pit if optional): simple tap-to-play or SKIP only; console replays inherit whatever the minigames get.
Smoke section "games": on the iPhone profile, enter and finish (win) each compulsory minigame by touch only, and check the safe-cut items can be finished or skipped.
At the end, the FULL check: ${CHECK(5502)}
Write the report. Return JSON per the build schema.`, { label: 'A: minigames by touch', phase: 'Build', schema: BUILD_SCHEMA })

const scenes = () => agent(`${CTX}${SPEED}${COMMON}

# Your role: TRACK B, SPECIAL SCENES, AIMING, DRIVING, TV (worktree ${SWT}, branch "s3-scenes"; dev ports 5522 / ALT 5532; scratch ${SP}/mobile/work/s3-scenes/; screenshots ${SP}/mobile/shots/s3-scenes/; report ${REPORTS}/s3-07-scenes.md)
Scope (map and complete it):
- Stationary gunners and aiming: the Night of Freedom drive (SanMikverse) and the plane cannon (MinigameScene "cannon", PlaneCabin): decide manual aim (drag to aim, a fire button) versus auto-aim per scene by playing both; the coordinator was asked to "say which scheme each one got and why": put that in the report and in notes.
- Driving and pedals: BeepBeepScene (pseudo-3D road), DriveScene, the Drawbridge (scenes/drive/Drawbridge.ts).
- The citadel (Citadel, citadel3d, RoofArena, foyer, RoofCutscene); the finale's concept boss (KrelfordFinale; wave 1 fixed its zoom) and KiMode / SsjBrawl remainders not covered by stage 2's brawl mode; Kreddle's Raid, RaidEscape and Rout.
- Pseudo-3D and cinematic scenes (scenes/p3d/*, scenes/ending/*, EndingScene, VignetteScene + scenes/vignette/*, CutsceneScene, ExileScene, LairScene, ArchiveScene, TutorialScene): every one can be watched, advanced and skipped by touch where the laptop can; skip pills where the laptop has a skip key.
- TV (TVScene, TVNews, TVPov, scenes/tv*): P5 from DEFERRED.md, phone subtitles/readability for shows and news where text is too small to read at 844x390 (show existing text bigger or re-laid; never change words), and channel/guide controls by touch (stage 2 did the guide's scrolling: keep it).
Smoke section "scenes": on the iPhone profile, each of the above reached and finished or skipped by touch only.
At the end, the FULL check: ${CHECK(5522)}
Write the report. Return JSON per the build schema.`, { label: 'B: scenes, aiming, driving, TV', phase: 'Build', schema: BUILD_SCHEMA })

const sound = () => agent(`${CTX}${SPEED}

# Your role: THE PHONE SOUND MIX (worktree ${SWT}, branch "s3-scenes", after track B finished there; dev ports 5542 / ALT 5552; scratch ${SP}/mobile/work/s3-sound/; report ${REPORTS}/s3-08-sound.md)
The user, verbatim, after playing on their iPhone: "Speech and sound effects are a little quiet on phones." Wave 1 (README "Stage 3: the phone platform", src/game/mobile/audio.ts) already routes iPhone songs and voices through Web Audio gain so the Music slider works (before, music ignored it and drowned speech).
Build, phones only (the laptop's sound must be byte-for-byte the same: same graph, same gains):
1. Find every sound path: Web Audio effects (Synth / sfx), voices (Voice.ts, the pooled <audio> route), songs, ambience/loops, TV audio.
2. A phone mix: voices and effects louder relative to music (e.g. phone default music gain about 0.6 of the laptop's, voice and effects up), and a gentle compressor/limiter on the phone's master path so speech is loud and clear on a phone speaker without clipping or pumping. The user's own slider settings still scale everything.
3. MEASURE before/after per category on the phone profile (an OfflineAudioContext or an AnalyserNode on the master: peak and RMS for a voice line over music, an explosion, a gunshot, a song alone); report the numbers. No clipping (peak under -1 dBFS).
4. Check the silent-switch behaviour and resume-after-lock still work, and ?mobilediag shows the mix.
Tests: unit tests for the gain plan; extend the smoke "platform" section with a mix check.
At the end, the FULL check: ${CHECK(5542)}
Commit (footer). Return JSON per the build schema.`, { label: 'sound: phone mix', phase: 'Build', schema: BUILD_SCHEMA })

phase('Build')
const [a, bs] = await parallel([games, async () => { const b = await scenes(); const s = await sound(); return { b, s } }])
const b = bs && bs.b, snd = bs && bs.s
log(`Builds: games ${a && a.ok}, scenes ${b && b.ok}, sound ${snd && snd.ok}`)

phase('Merge')
const merge = await agent(`${CTX}${SPEED}

# Your role: MERGE stage 3 wave 2 (worktree ${GWT}, branch "s3-games"; dev ports 5502 / 5512; report ${REPORTS}/s3-09-merge.md)
Two tracks were built in parallel from 68584994: "s3-games" (minigames by touch; report s3-06-games.md) and "s3-scenes" (special scenes, aiming, driving, TV, then the phone sound mix; reports s3-07-scenes.md, s3-08-sound.md). In ${GWT}:
1. "git merge s3-scenes". Then "git merge s3-tap" (wave 1's branch with whatever review fixes it has by now) and "git merge mobile" (if it moved). Resolve conflicts keeping every side's behaviour. No rebase.
2. Integration checks on the iPhone profile: a minigame entered by tap-to-use from a walking scene plays by touch and pauses on lock; sound mix active in a minigame and a TV show; the stick and pocket buttons unchanged in a fight.
3. The FULL check: ${CHECK(5502)}
Commit (footer), worktree clean, nothing pushed. Return JSON per the merge schema.`, { label: 'merge wave 2', phase: 'Merge', schema: MERGE_SCHEMA })

const RULES = `
You are a REVIEWER. Do not edit any file in ${GWT} and do not commit. Scratch and screenshots under your own folders. Report real, specific, reproducible problems only, each with: id (prefix below), severity (blocker = cannot progress, softlock, data loss, crash, or any non-phone device affected; major = painful, confusing, unfair or wrong; minor = cosmetic), where, repro, suggested fix. affectsLaptop true only if a non-phone device is affected.
Stage 3 wave 2 is on branch "s3-games" in ${GWT}: everything after 68584994 (plus what came from s3-tap and mobile).`
const lenses = [
  { key: 'laptop', label: 'review: laptop unchanged', prompt: `${CTX}${SPEED}
# Your role: LAPTOP-UNCHANGED REFUTER (ports 5503 / 5513; scratch ${SP}/mobile/work/s3w2-review-laptop/; prefix "L")
${RULES}
Claim to attack: on laptops and every non-phone device, the game is exactly as before. Read every changed line outside src/game/mobile/ (git diff 68584994..HEAD and 37a710d4..HEAD). This wave touched minigame and scene input, aiming, driving, TV text and the AUDIO MIX: an input listener, a gain, a compressor node, a text size or a timing that differs on a laptop is a finding. Play each changed minigame/scene for a minute on the laptop against a base server from 496f1066 in a throwaway worktree (cp -al node_modules; remove it after). Then run: ${CHECK(5503)}` },
  { key: 'player', label: 'review: blind phone player', prompt: `${CTX}${SPEED}
# Your role: BLIND FIRST-TIME PHONE PLAYER (port 5504; scratch ${SP}/mobile/work/s3w2-review-player/; screenshots ${SP}/mobile/shots/s3w2-review-player/; prefix "P")
${RULES}
Do not read the reports before playing. iPhone 14 landscape with insets, real touch events; spot-check 740x360. Play every minigame and special scene you can reach (DebugSkip), as a friend would: do you understand what to do within seconds? Is it fun, fair, readable? Anything you can't do, can't see, or that sits under your thumb? Rhythm games: do taps feel in time? Mashers: tiring? Aiming: comfortable? Driving: controllable? TV: readable? Sound: speech clear over music? Report with screenshots.` },
  { key: 'robust', label: 'review: minigame robustness', prompt: `${CTX}${SPEED}
# Your role: MINIGAME ROBUSTNESS REVIEWER (port 5505; scratch ${SP}/mobile/work/s3w2-review-robust/; prefix "R")
${RULES}
Find real defects with a failing scenario: softlocks (win/lose/exit never reached by touch), inputs stuck after pause/resume or a lock mid-game, multi-touch confusion, the touch layer left in a minigame mode after exiting, rewards or flags differing from the laptop path, rhythm timing offsets wrong after resume, audio compressor pumping or clipping, gain leaks across scenes, per-frame costs. Judge the tests: which assertions are vacuous?` },
]

const reviews = await parallel(lenses.map(l => () => agent(l.prompt, { label: l.label, phase: 'Review', schema: FINDINGS_SCHEMA })))
let findings = []
reviews.forEach((r, i) => { if (r && r.findings) for (const f of r.findings) findings.push({ ...f, lens: lenses[i].key }) })
log(`Review: ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blockers, ${findings.filter(f => f.affectsLaptop).length} non-phone)`)

const fixPrompt = (list, round) => `${CTX}${SPEED}
# Your role: FIXER, stage 3 wave 2 round ${round} (worktree ${GWT}; ports 5506 / 5516; scratch ${SP}/mobile/work/s3w2-fix${round}/; report ${REPORTS}/s3-10-fix-round${round}.md)
If the report already exists, an earlier run was cut off: continue from it and the git log.
Reviewers can be wrong: confirm each finding (code + reproduction) first. Real: fix the root cause and add a test where practical. Not real: reject with evidence. Device-only (needs a real phone): defer it into ${REPORTS}/DEFERRED.md under "Stage 4". affectsLaptop findings and blockers are fixed now or disproved; never deferred. Majors are this wave's job.
Then: ${CHECK(5506)}
Commit (footer), worktree clean, README updated where behaviour changed.
Findings:
${JSON.stringify(list, null, 1)}`

const gatePrompt = (round) => `${CTX}${SPEED}
# Your role: FINAL GATE, stage 3 wave 2 round ${round} (worktree ${GWT}; ports 5507 / 5517; scratch ${SP}/mobile/work/s3w2-gate${round}/; report ${REPORTS}/s3-11-gate-round${round}.md)
Decide whether branch "s3-games" is safe to publish. Trust nothing; run everything yourself; do not edit game code.
1. ${CHECK(5507)}
   Read every changed line outside src/game/mobile/ since 37a710d4: guarded hooks, imports or tooling only. Play the laptop for 3 minutes including two minigames, a TV show and the sound against a base server from 496f1066 in a throwaway worktree (remove it after): no difference.
2. Production builds main and ALT succeed (temp folder, deleted); a laptop boot never requests the phone chunk.
3. Phone (iPhone 14 with insets, 740x360), real touch: smoke passes; three compulsory minigames won by touch only; a safe-cut item finished or skipped; Night of Freedom and the plane cannon playable; Beep Beep drivable; a pseudo-3D scene and a TV show readable and skippable; lock/unlock mid-minigame resumes paused with sound; tap-to-use and fights still work.
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
  const f = await agent(fixPrompt(gate.blockers.map(x => ({ ...x, severity: 'blocker', lens: 'gate' })), round), { label: `fix gate blockers (round ${round})`, phase: 'Fix', schema: FIX_SCHEMA })
  fixes.push(f)
  gate = await agent(gatePrompt(round), { label: `final gate (round ${round})`, phase: 'Gate', schema: GATE_SCHEMA })
}
return { stage: 'stage3-wave2', builds: { games: a, scenes: b, sound: snd }, merge, findings, fixes, gate, rounds: round }

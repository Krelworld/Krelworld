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
- LIVE (branch claude/krelworld-game at 0da900db): the phone version's stages 1-2, the thumb-feel round and the newer iPhone Add to Home Screen steps. Other workflows run right now on branches s3-tap, s3-games, s3-scenes, game-adds and autofire: do NOT touch their worktrees.
- The auto-fire audit is finished: read ${REPORTS}/ga-02-autofire.md (branch "autofire" added Settings > Firing: AUTO / LIGHT / STILL / HOLD, AUTO still default) and ${REPORTS}/USER-DECISION-AIM.md.
- THE USER JUST PLAYED THE LIVE GAME ON THEIR PHONE and said, verbatim: "Just played on phone. There weee no sound effects in dungeon. It was both auto firing and auto aiming. It was so easy".
  Earlier, verbatim: "Hold fire with aim assist works but it *is* very easy but I worry adding an aim thing might be too rough." Then they chose options 1 and 4: "1 and 4 sound good" = (1) aim assist only within about 35 degrees of where you face, (4) no lock onto enemies that are off screen or behind walls. No aim stick by default.
- THIS workflow fixes both things the user reported.

## Hard rules
1. LAPTOP UNCHANGED. On any device that is not a phone (laptops, touchscreen laptops, iPads, Android tablets, the Fire 7), the game must behave, look, sound, save and perform exactly as before. Phone mode is the runtime flag isMobile().
2. Containment: new phone code lives under src/game/mobile/ (it loads as the lazy phone chunk through boot.ts; keep it that way: laptops must not fetch it). Existing game files may only get small guarded hooks ("if (isMobile()) ...", "isMobile() ? a : b") or imports of flag.ts. Game-rule changes that only phones get (jump buffer, coyote time, variable jump height, ledge forgiveness, auto-collect radius, aim assist) are allowed as such guarded hooks. Prefer observing and driving the game from outside. Do not edit index.html, the scene list in main.ts or the Phaser game config.
3. DIALOGUE. Never change, add, remove or reword any dialogue or story text. The user said, verbatim: "YOUR QA WAS NOT FOR DIALOGUE. If you've made any changes to dialogue, revert them." Showing existing lines differently on phones (bigger text, re-paginated into more boxes, a back-log of lines already shown, skip or auto-advance) is allowed; the words stay identical.
   One narrow exception: a pure control instruction shown by the game's own narrator or system voice, not spoken by a character (for example Home's "TIP: WASD / arrows (or the stick) to walk. E to use things."), may be swapped for touch wording ON PHONES ONLY through hint()/touchWording, with the laptop line unchanged. A character's line that mentions a key stays exactly as it is. List every line you swapped and every character line that mentions a key in your report.
4. Both builds: main and ALT (VITE_KREL_ALT=1, src/game/variant.ts). Phone mode works identically in both; add no ALT-only differences. Use storageKey() for any localStorage key.
5. Content: no new story content of any kind (the bike's one-line first-time tip and its control labels are UI text, which is fine).
6. Never write a model name or the user's email address into any file, commit message or comment. End every commit message with exactly these two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VMaYe2CeeKzcmBuCUqa9Rb
7. Commit in your worktree with clear messages (what changed for the player). Leave the worktree clean when you finish. NEVER edit, checkout, reset or stash anything in /home/user/Rory-s-rangers- (the main checkout). NEVER push and never create a PR: the coordinator pushes after review.

## The machine (important)
- 4 CPUs, 15 GB RAM, about 8 GB disk free. Up to five other agents run at the same time as you (the machine is VERY loaded; disk is tight: about 5 GB free, keep scratch small) (heavy load: expect slowness; never treat a timing failure under load as proof of a bug without re-running it once).
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



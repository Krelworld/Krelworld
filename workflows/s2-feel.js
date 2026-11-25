export const meta = {
  name: 'krelworld-mobile-stage2-feel',
  description: 'KRELWORLD phone stage 2: the user phone feedback (stick, jumping, specials, pause) in its own worktree, then an independent re-check',
  phases: [ { title: 'Feel', detail: 'fix, then re-check' } ],
}
const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const FWT = SP + '/mobile-feel-wt'
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



phase('Feel')
const feel = await agent(`${CTX}

# Your role: THUMB FEEL fixes from the user's own phone test (worktree ${FWT}, branch "mobile-feel", dev ports 5222 / 5232)
Stage 2 is built, gated and polished (${REPORTS}/s2-08-polish.md). Another agent is verifying the polish in ${WT} at the same time (ports 5203/5213): do not touch that worktree. Your worktree is a copy at the same commit; work only there.

The user then played the LIVE site on their iPhone. The live site is still stage 1, where fights use the game's OLD canvas touch pad, so some of this may already be solved by stage 2; your job is to make sure it is, by playing the stage 2 build by touch as a first-time player would, and to fix what is not. Their words, verbatim:
1. "jumping feels a little awkward"
2. "The specials, when they do activate, are tiny to press"
3. "Is there a pause button?"
4. "The joystick you use to move your character can slide all over the screen, if your thumb does. Is it supposed to do this"

Do:
A. Stick (4): the stick currently appears where the thumb lands and FOLLOWS the thumb past its rim (setting "stick": floating / fixed). Make the default a stick whose base stays where the thumb first landed for that touch (it does not drag around after the thumb); pulling past the rim just means full speed in that direction. Keep the base inside the stick zone. Keep the setting, relabelled so the choices are clear (e.g. "STAYS WHERE YOU TOUCH" default, "FOLLOWS YOUR THUMB", "FIXED SPOT"), whatever reads best; an existing saved choice of the old default should map to the new default. Update tests, smoke, README.
B. Jumping (1): play the side rooms by touch at 844x390 (iPhone insets) and 740x360 for several minutes as a player would (run, jump pits, platforms, movers, double jump, jump while running and firing). Look for what makes it awkward: thumb has to travel too far between JUMP and FIRE, JUMP too close to the edge or the home bar, the hold-for-height window, stick-up also jumping or not, input latency, camera jolts, the pit under JUMP going see-through. Compare with research "Jumping (detailed)". Fix the causes (phone-only), and describe before/after in your report with numbers.
C. Specials (2): whenever a special, drink, IBS, WONK, CUME, SanMik or Kreltality becomes usable, the thing to press must be a big thumb-sized button (at least 60 CSS px drawn at 844x390, 44 px minimum touch on every phone) in reach of the right thumb, not a small chip. The top-left chips (fart / bongo / SanMik at 32 px drawn) are too small for anything you need mid-fight: rethink them (e.g. the READY button offers whichever is ready, or chips grow to full size when usable). Keep the clutter rule from the polish (nothing shown that cannot be used now).
D. Pause (3): confirm a clear pause button is visible in EVERY phone mode (walking, fights, side rooms, brawls, menus where pausing makes sense, minigames that have their own pause on laptop) and that it is big enough (44 px touch). If any mode lacks one, add it. Report where it is.
All changes phone-only. Then the FULL check: ${CHECK(5222)}
Screenshots (1x) into ${SP}/mobile/shots/s2-feel/. Report ${REPORTS}/s2-10-feel.md. Commit in small steps with the footer; worktree clean; servers stopped; nothing pushed.
Return JSON per the schema (dispositions ids: STICK, JUMP, SPECIALS, PAUSE, plus any verify blocker ids).`, { label: 'feel: stick, jump, specials, pause', phase: 'Feel', schema: FIX_SCHEMA })

const recheck = await agent(`${CTX}

# Your role: INDEPENDENT re-check after the thumb-feel fixes (worktree ${FWT}, branch "mobile-feel", dev ports 5222 / 5232)
You did not write this code. Read ${REPORTS}/s2-10-feel.md and its commits ("git log 37a710d4..HEAD"). The user found on their iPhone: jumping awkward, specials tiny to press, no obvious pause button, the movement stick sliding all over the screen. Check each by real touch (iPhone 14 profile 844x390 insets 47/47/21, and 740x360), adversarially, as a first-time player: does jumping feel immediate and forgiving; is every usable special a big button within reach; is there a pause button in every mode; does the stick stay put. Also check nothing overlaps (captions, chips, HUD) and nothing unusable is shown.
Then the FULL check: ${CHECK(5222)}
Plus "git diff origin/claude/krelworld-game -- tests/fingerprints index.html tests/desktopInvariants.test.ts" must be empty, and production builds of main and ALT (temp folder under ${SP}/mobile/work/recheck/, deleted after) must build with a laptop boot never requesting the phone chunk.
Screenshots (1x, at most 25) into ${SP}/mobile/shots/s2-recheck/. Report ${REPORTS}/s2-11-recheck.md. Only one-line phone-only fixes you are certain of (commit with footer, re-run affected checks); otherwise list blockers. Servers stopped, worktree clean, nothing pushed.`, { label: 'recheck: thumb feel', phase: 'Feel', schema: GATE_SCHEMA })

return { feel, recheck }

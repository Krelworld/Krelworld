export const meta = {
  name: 'krelworld-mobile-foundation',
  description: 'KRELWORLD phone mode, stage 1: laptop safety net, phone flag and shell, touch layer for walking, readability mechanism, then independent review and fixes',
  phases: [
    { title: 'Safety net', detail: 'record the laptop version before any phone code exists' },
    { title: 'Build', detail: 'phone flag, shell, touch layer, readability mechanism, settings, diagnostics' },
    { title: 'Review', detail: 'laptop-unchanged refuter, blind phone play-test, robustness review' },
    { title: 'Fix', detail: 'fix confirmed findings' },
    { title: 'Gate', detail: 'final laptop and phone checks' },
  ],
}

const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const AUDIT = SP + '/mobile_audit/MOBILE_AUDIT.md'
const REPORTS = SP + '/mobile/reports'

const CTX = `
# Project context (read all of this first)

KRELWORLD is a private comedy action-RPG (Phaser 3.90 + TypeScript + Vite) that plays in a browser. It was built for laptops (keyboard and mouse). We are now making it properly playable in a PHONE browser, held sideways (landscape), WITHOUT changing the laptop version in any way.

## The user's instructions (verbatim, they are the spec)
- "Right now the game is basically unplayable in a phone. ... a full audit and change of the game for a phone browser version (making NO changes to the main laptop version of the game). I think things like combat would need to be either simplified or optimized, and special buttons etc would need to be changed to screen taps, but also in a way that didn't obscure or fuck with gameplay too much. Should be played sideways on phone."
- "Do everything we just spoke about. Make the game playable on a phone. Do *not* change the laptop experience. Refer to *all* the notes you made. Make sure the user experience is comfortable, that jumping etc doesn't feel awkward. Refer to the conversation we had earlier and the report you made. Do *not* change the main game, you are making it playable on phone."

## The notes and the report
- FIRST read ${REPORTS}/00-USER-PRIORITIES.md : the user's own words and what "mega intuitive and fun", "landscape" and "Add to Home Screen" mean for every decision. It overrides anything below that conflicts with it (except the hard rules).
- Then ${REPORTS}/RESEARCH-phone-games.md : research into how comparable games work on phones (checked claims, a prioritised change list and a numbers table). Where it gives a 'must' or 'should' change for the part you are building, follow it; where you deviate, say why in your report.
- The full phone audit: ${AUDIT} (about 470 lines). READ IT IN FULL before designing anything. Sections: 1 summary and blocker list, 2 per-scene findings, 3 recommended control scheme (with the 844x390 layout table), 4 MOBILE flag plan, 5 orientation plan, 6 performance plan, 7 phased plan, 8 other bugs, 10 device checks.
- Its screenshots: ${SP}/mobile_audit/shots/ and its Playwright driver ${SP}/mobile_audit/work/harness.cjs (reusable: it knows how to reach every scene).
- Reports from earlier agents in this effort (read any that exist): ${REPORTS}/
- The whole effort is staged. THIS workflow is stage 1 (foundation). Later stages (not yours): stage 2 = combat HUD and controls (FIRE, DODGE, JUMP, SMART, weapon chip, phone assist) in parallel with menus, dialogue and readability layout fixes plus the touch-wording sweep; stage 3 = every minigame and scene made touch friendly, plus audio, memory and performance; stage 4 = full QA. Design so those stages can build on your work.

## Where you work
- Git worktree: ${WT}  (branch "mobile", based on the live game branch). Do ALL work there.
- NEVER edit, checkout, reset or stash anything in /home/user/Rory-s-rangers- (the main checkout). NEVER push anywhere and never create a PR: the coordinator pushes after review.
- node_modules in the worktree is a hard-linked copy: never modify or reinstall packages. No npm or pip installs at all. Playwright and Chromium are preinstalled (require('playwright'), chromium.launch() needs no options).
- A "git gc" may be running in the repository in the background. If a git command fails with a lock error, wait a few seconds and retry. Never run git gc or git prune yourself.
- Scratch files (your own test scripts, screenshots, notes) go under ${SP}/mobile/work/<your-role>/ and ${SP}/mobile/shots/ : never in the repo unless they are a deliverable.

## Hard rules
1. LAPTOP UNCHANGED. On any device that is not a phone, the game must behave, look, sound, save and perform exactly as before: same display list, same input handling, same timing, same saved data, no new DOM, no new listeners doing work, no per-frame cost. Phone mode is a runtime flag (isMobile()) that is false on laptops (including touchscreen laptops) and in node/vitest.
2. Containment: all new phone code lives under src/game/mobile/. Existing files may only get small guarded hooks ("if (isMobile()) ...", "isMobile() ? a : b") or imports. Prefer zero-hook designs (the mobile module observing the game from outside) over editing scene files. Do not edit index.html, the scene list in main.ts or the Phaser game config.
3. NEVER change, add, remove or reword any dialogue or story text. Control hints and UI labels may be swapped for touch wording ON PHONES ONLY through a helper; a line of character dialogue that happens to mention a key is still dialogue: leave it and list it in your report.
4. Both builds: the game has a main build and an ALT build (VITE_KREL_ALT=1, see src/game/variant.ts). Phone mode must work identically in both; add no alt-only differences. Use storageKey() from variant.ts for any localStorage key.
5. Content: no slurs (the game's existing text stays as it is), nothing sexual involving minors, no new story content of any kind. This is a controls and layout job.
6. Never write a model name or the user's email address into any file, commit message or comment. End every commit message with exactly these two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VMaYe2CeeKzcmBuCUqa9Rb
7. Commit in the worktree on branch "mobile" with clear messages (what changed for the player). Leave the worktree clean (git status empty) when you finish.

## The machine (important)
- 4 CPUs, 15 GB RAM, disk is tight (about 5 GB free). Another agent may be running at the same time.
- Run ONE browser at a time and close it when a script ends. Two heavy browsers at once have crashed this container before.
- Keep screenshots at 1x for your own checks and keep at most about 30 of them. No frame dumps. Production builds write about 400 MB: build to a temp folder under ${SP}/mobile/work/ and delete it straight after.
- It is slow: a page boot takes 15 to 60 seconds. Use generous timeouts (120 s+). Run commands in the foreground; do not leave long background wait loops.
- Dev server: run your own Vite from the worktree on YOUR port (given below) with "npx vite --port <port> --strictPort", and stop it when done (pkill -f "vite --port <port>"). ALT dev server: VITE_KREL_ALT=1 npx vite --port <port> --strictPort.

## How to drive the game
- The page opens on an "Enter" gate scene (press Enter or tap) and then the Title.
- Debug API: window.__krel (newRun, setChapter, state(), scene(k), tp(x,y), game). In a dev page "await import('/src/game/Flow.ts')" works (switchTo etc).
- src/game/scenes/DebugScene.ts (DebugSkip: goCh / goArc / goBoss) drops you into any chapter, side quest or boss. Chapter Select on the title is password protected; the password is "krunt".
- To reach a clean hub: set flags chN_intro, chN_home and home_seen, then stop the Dialogue and Enter scenes.
- Phone emulation in Playwright: iPhone 14 landscape = viewport 844x390, deviceScaleFactor 3, isMobile true, hasTouch true, a mobile Safari user agent; also 750x340 (Safari with its bars), a small Android 740x360, and portrait 390x844. Use page.touchscreen.tap and real touch events (CDP Input.dispatchTouchEvent for drags and multi-touch), not mouse clicks.
- Deterministic stepping reference (fake clock, runFor per frame): ${SP}/tvtrailer/tvcap.cjs.
- Existing touch support to understand first: src/game/ui/TouchControls.ts (TOUCH, TouchControls, isTouchDevice), UIScene.setupTouch, the Controls class that reads TOUCH, src/game/systems/fullscreen.ts, src/game/variant.ts, src/main.ts, src/game/ui/theme.ts (button()).
`

const BASE_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, commit: { type: 'string' }, runCommand: { type: 'string' }, checkCommand: { type: 'string' },
  scenesCovered: { type: 'array', items: { type: 'string' } }, excluded: { type: 'array', items: { type: 'string' } },
  deterministic: { type: 'boolean' }, notes: { type: 'string' } },
  required: ['ok', 'commit', 'checkCommand', 'deterministic', 'notes'] }

const BUILD_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } },
  hooksOutsideMobile: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, what: { type: 'string' } }, required: ['file', 'what'] } },
  apiSummary: { type: 'string' },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'smoke'] },
  gaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
  required: ['ok', 'commits', 'apiSummary', 'checks', 'gaps', 'notes'] }

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
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'smoke'] },
  notes: { type: 'string' } },
  required: ['ok', 'commits', 'dispositions', 'checks', 'notes'] }

const GATE_SCHEMA = { type: 'object', properties: {
  pass: { type: 'boolean' }, laptopUnchanged: { type: 'boolean' }, mobileSmoke: { type: 'boolean' },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, buildMain: { type: 'boolean' }, buildAlt: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'buildMain', 'buildAlt'] },
  blockers: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' }, affectsLaptop: { type: 'boolean' } }, required: ['id', 'title', 'detail', 'affectsLaptop'] } },
  headCommit: { type: 'string' }, notes: { type: 'string' } },
  required: ['pass', 'laptopUnchanged', 'mobileSmoke', 'checks', 'blockers', 'headCommit', 'notes'] }

// ---------------------------------------------------------------- 1. Safety net
phase('Safety net')
// The safety net was built, committed (9ccb2d13) and reported (${REPORTS}/01-safety-net.md) in the first run;
// only its structured return was lost to a usage limit, so its result is filled in from the report.
const base = {
  ok: true, commit: '9ccb2d13', deterministic: true,
  runCommand: 'node scripts/desktop-fingerprint.cjs --url http://localhost:<port>/ --alt-url http://localhost:<port+10>/  (RECORD: never re-record)',
  checkCommand: 'start your own dev servers (normal on your port P, ALT on P+10: VITE_KREL_ALT=1 npx vite --port <P+10> --strictPort), then run the laptop check in two halves (each under 6 minutes): node scripts/desktop-fingerprint.cjs --url http://localhost:<P>/ --alt-url http://localhost:<P+10>/ --check --only shell,front,newgame,hub,meeting,dungeon  AND  node scripts/desktop-fingerprint.cjs --url http://localhost:<P>/ --alt-url http://localhost:<P+10>/ --check --only boss,side,places,minigames,finale,alt ; both must end with DESKTOP FINGERPRINT: OK, and npx vitest run tests/desktopInvariants.test.ts must pass unedited. See tests/fingerprints/README.md and ' + REPORTS + '/01-safety-net.md (read its "Things later stages should know": what trips the check on a laptop).',
  scenesCovered: ['65 states in 12 chains: see 01-safety-net.md'], excluded: ['sound playback, rendered pixels, frame rate, gamepad, scenes not listed: see 01-safety-net.md'],
  notes: 'Recorded on dda0580c; 241 vitest tests pass.'
}

if (!base || !base.ok) return { stage: 'safety-net-failed', base }
log(`Safety net recorded (${(base.scenesCovered || []).length} states, deterministic: ${base.deterministic})`)

// ---------------------------------------------------------------- 2. Build
phase('Build')
const b1 = await agent(`${CTX}
# Your role: FOUNDATION BUILDER, part 1 of 2 (your Vite port: 5202; scratch: ${SP}/mobile/work/build1/)

The laptop safety net is committed (read ${REPORTS}/01-safety-net.md; check command: ${base.checkCommand}). Now build the core of phone mode. Read the audit in full first, especially sections 3, 4 and 5 and the blocker list.

## Build (all under src/game/mobile/ unless a guarded hook is unavoidable)
1. The flag: isMobile() as designed in audit section 4. Phones only: primary pointer coarse AND no hover AND touch points > 0 AND the short side of the screen <= 600 CSS px. "?mobile=1" forces it on (for development on a laptop) and "?mobile=0" forces it off on a phone; the choice is remembered through storageKey(). Evaluated once at startup. setMobileForTests(). Must import cleanly in node (vitest), where it is false. Tablets and touchscreen laptops keep exactly today's behaviour.
2. The shell (phones only, added at runtime, index.html untouched): "mobile" class on html plus the CSS from audit section 5 (touch-action none, no text selection, no callout, no tap highlight, no overscroll, full dynamic viewport height); fix the double centring ON PHONES ONLY so the canvas is truly centred and the gutters are symmetrical; a DOM rotate-your-phone overlay in portrait that also covers the boot load and, while up, sleeps the game loop and pauses music and sound, then resumes cleanly in landscape (iPhone wording adds a hint about rotation lock); on Android, on the Enter-gate tap, request fullscreen and lock landscape in try/catch, with a small re-offer control if the player leaves fullscreen; on iPhone keep and reuse the existing Add to Home Screen hint; refresh the Phaser scale when visualViewport resizes (Safari's bars collapsing); on visibilitychange hidden / pagehide pause the loop, pause the music element, suspend the audio context and save, and resume properly afterwards.
3. The DOM touch layer (audit section 3, "Architecture" and "Rules"): a transparent full-window layer above the canvas, pointer-events none except on its controls, feeding the game's existing TOUCH object so the game logic is unchanged. Sized in real CSS px, anchored to the safe edges with env(safe-area-inset-*), usable in the letterbox gutters (a stick drag that starts in a gutter must work), nothing interactive in the bottom 21 px, minimum 52 CSS px controls with a hit area 8 px larger than the drawing, outline style about 30% opacity and 70% while pressed, each press owned by its touch id until release, multi-touch safe (stick and a button at once), touchcancel handled, no stuck inputs when the mode changes or the page is hidden mid-press, DOM writes via transforms only. Left-handed mirror, size S/M/L and opacity must be supported by the layout code (the settings store arrives in part 2: read them from a small typed object with defaults that part 2 will back with storage).
   - Modes: none, walk, combat, side, brawl, tap. Provide the mode API and registry now. IMPLEMENT FULLY in this job: "walk" (floating stick that appears under the left thumb anywhere in the left 45% of the window, gutter included; a contextual ACTION button that only exists while a prompt is active and shows the verb; a pause button), "none" and "tap" (no stick; pause where pausing is allowed).
   - A quick tap inside the stick zone that does not turn into a drag must still reach the game as a tap at that point (so tapping an object, a prompt bubble or a canvas button on the left half still works).
   - Prefer driving modes from OUTSIDE the scenes: a table in the mobile module from scene keys and observable state (which scenes are active, whether a dialogue, menu, cutscene, TV or minigame is up, whether a prompt is showing and its verb) to the mode, polled cheaply on phones only. Add scene hooks only where observation truly cannot work.
   - Combat for now: stage 2 will build the combat controls. Until then, in combat scenes on phones the game's EXISTING touch pad (TouchControls in the UI scene) must keep working exactly as today, and the new layer must not double up with it or steal its touches. In walking scenes the new layer replaces the old pad on phones (the old pad is what is invisible in Home, the Club, Kreddle and the Venue: blocker B1).
   - The first tap that unlocks audio (synth.unlock on pointerdown) must still happen when the first touch lands on the layer.
4. Fix blockers B1 (controls visible and working in Home, Club, Kreddle, Venue and every other free-roam scene) and B2 (portrait). Make the pause button reach the existing pause menu from every scene where pausing is allowed.
5. Tests and tools: vitest unit tests for the flag logic (with mocked matchMedia/navigator/screen/location, and the node default false), for the mode table, and for layout maths (mirror, sizes, safe-area clamping); scripts/mobile-smoke.cjs, a Playwright phone smoke test (iPhone 14 landscape, real touch events) that boots by taps, starts a new game, reaches Home and asserts: the stick appears and a drag moves the player (including a drag that starts in the left gutter), ACTION appears at an interactable and triggers it, pause opens and closes, portrait shows the overlay and the loop sleeps, landscape resumes, "?mobile=0" gives no layer and no "mobile" class; plus desktop assertions (isMobile() false, no "mobile" class, no layer element, UI scene touch state as before).
6. src/game/mobile/README.md : the architecture, the hook rules, the mode API, how later stages add controls and adapters, how to run the smoke test and the laptop check.

## Verify before you finish
- ${base.checkCommand} must be green (laptop fingerprints byte-identical), "npx tsc --noEmit" and "npx vitest run" must pass, the smoke test must pass. If the fingerprint check fails, your change touched the laptop: fix your change, never the baseline.
- Look at phone screenshots yourself (Home, Hub, Club, Kreddle, a dialogue, the pause menu, portrait) and fix what looks wrong.

## Report
Write ${REPORTS}/02-build1.md (what exists, the API, every hook outside src/game/mobile and why, what is left for part 2 and later stages, anything you were unsure about) and return the structured result.`,
  { label: 'flag, shell, touch layer', phase: 'Build', schema: BUILD_SCHEMA })

if (!b1 || !b1.ok) return { stage: 'build1-failed', base, b1 }
log('Build part 1 done: ' + (b1.commits || []).join(', '))

const b2 = await agent(`${CTX}
# Your role: FOUNDATION BUILDER, part 2 of 2 (your Vite port: 5202; scratch: ${SP}/mobile/work/build2/)

Part 1 built the flag, the shell and the DOM touch layer with walking controls. Read src/game/mobile/README.md, ${REPORTS}/01-safety-net.md and ${REPORTS}/02-build1.md, then the audit in full. Laptop check command: ${base.checkCommand}. Part 1's summary of its API:
${b1.apiSummary}

Part 1 listed these gaps: ${JSON.stringify(b1.gaps || [])}. Close any that belong to the foundation.

## Build (all under src/game/mobile/ unless a guarded hook is unavoidable)
1. Phone settings store: one typed store with defaults, persisted in its OWN localStorage key through storageKey() (do NOT add fields to the game's Settings/MetaState or change defaultSettings(): laptop save data must stay byte-identical). Include every setting later stages need so they do not have to change the schema: leftHanded (mirror), buttonSize (S/M/L), opacity, autoFire, aimAssist (sticky auto-aim), phoneAssist (default on), batterySaver (30 fps cap, default off), readability (see 2), haptics (vibrate on press where supported, default on). Wire leftHanded, buttonSize and opacity into part 1's layer live (changing a setting updates the layer at once). Provide change listeners. Do not build the settings SCREEN: stage 2 builds the touch-friendly menus; expose a tiny typed API (list of settings with label, type, options, get, set) that a screen can render.
2. Readability mechanism for phones: the game canvas is 960x540 game px shown at roughly 0.63 to 0.72 scale on a phone, so 11 to 13 px text ends up 7 to 9 CSS px. Build the mechanism the audit's phase 3 calls for: a phone-only font floor (find how the game patches or creates text, e.g. the font patch the audit mentions, and apply a floor so no text renders below about 10 CSS px on the physical screen, computed from the real canvas scale) and a phone-only minimum hit size for button() and other interactive canvas objects (at least 44 CSS px tall hit areas, without moving the drawing). Because raising fonts will overflow some existing layouts until stage 2 fixes them screen by screen, ship the mechanism controlled by the settings store's "readability" switch plus a "?mobileread=1/0" URL override, DEFAULT OFF for now, and document exactly how stage 2 turns it on. With it off, phone rendering of text is unchanged from part 1. Laptop: no change either way.
3. Touch wording helper: hint() (or similar) in the mobile module that, on phones only, swaps key wording for touch wording in control hints and UI prompts ("Press E" -> "Tap", "SPACE" -> the matching touch control, and so on), with a table that stage 2 can extend. Apply it in this job only to the prompts that walking scenes show (interact prompts in Home, Hub, Club, Kreddle, Pub, Polson Towers, the Venue, shops). NEVER touch character dialogue or story text: if a dialogue line mentions a key, leave it and list it in your report.
4. Diagnostics overlay: "?mobilediag" shows a small DOM overlay with fps (from game.loop.actualFps), an estimate of texture memory (sum of width x height x 4 over the texture manager) and texture count, decoded audio estimate if obtainable, audio context state, viewport and visualViewport sizes, devicePixelRatio, the canvas CSS box and scale, safe-area inset values, current touch mode, isMobile and why (which detection terms matched), and the last uncaught error. Works on phones and, for development, with ?mobile=1. Zero cost when the parameter is absent.
5. A written ten-minute device checklist for the user at ${SP}/mobile/DEVICE_CHECKLIST.md (plain language, for a non-technical reader): what to try on an iPhone and on an Android phone with the live link, what to look at in ?mobilediag, and what to report back (see audit section 10).
6. The Add to Home Screen guide: build it EXACTLY as specified in the "Add to Home Screen" section of ${REPORTS}/00-USER-PRIORITIES.md (per-browser steps with drawn icons for iPhone Safari, iPhone Chrome/Edge/Firefox, in-app browsers such as Messenger/Instagram/Facebook/TikTok/Snapchat -> open in Safari/Chrome first, Android Chrome/Edge with a real INSTALL button via beforeinstallprompt plus a written fallback, Samsung Internet, Firefox Android; the one-line why; shown once on the first phone run BEFORE the player starts a game, dismissible; never when already running standalone; always reachable from the title screen, the pause menu and the rotate screen on phones; the iPhone separate-storage warning, which the research report confirms from WebKit's own pages; the manifest/apple meta plumbing checked for BOTH sites: main under /Krelworld/, alt at the root; index.html stays untouched). The existing one-line iPhone hint on the title (TitleScene) must not show twice on phones: the guide replaces it there, guarded by isMobile(); laptops keep exactly what they have. Landscape-first layout at 844x390 / 740x360 / 750x340, plus the portrait version on the rotate screen. Screenshot every variant.
7. Extend scripts/mobile-smoke.cjs and the unit tests to cover the settings store (persistence, defaults, live update of the layer, private-mode storage failure does not throw), the readability mechanism on and off (measure real rendered text heights in CSS px on a couple of screens with it on; assert no text under 10 CSS px there; with it off assert the display matches part 1), the hint helper table, and the diagnostics overlay. Update src/game/mobile/README.md. Also cover the Add to Home Screen guide in the smoke test (each browser variant via user-agent and display-mode emulation).

## Verify before you finish
- ${base.checkCommand} green, "npx tsc --noEmit" and "npx vitest run" pass, the smoke test passes, and you have looked at phone screenshots with readability on and off and of every Add to Home Screen variant.

## Report
Write ${REPORTS}/03-build2.md and return the structured result (apiSummary must describe the settings API, the readability switch and how to turn it on, the hint helper, and the diagnostics overlay).`,
  { label: 'settings, readability, wording, diagnostics, home screen guide', phase: 'Build', schema: BUILD_SCHEMA })

if (!b2 || !b2.ok) return { stage: 'build2-failed', base, b1, b2 }
log('Build part 2 done: ' + (b2.commits || []).join(', '))

// ---------------------------------------------------------------- 3. Review (diverse lenses)
phase('Review')
const REVIEW_RULES = `
You are a REVIEWER. Do not edit any file in the worktree and do not commit: write scratch scripts and screenshots only under your scratch folder. Report real, specific, reproducible problems; do not pad the list. For each finding give an id (prefix given below), a severity (blocker = cannot progress or the laptop is affected; major = painful or wrong; minor = cosmetic), where it is, how to reproduce it, and a suggested fix. Set affectsLaptop true only when a non-phone device is affected.`

const lenses = [
  { key: 'laptop', label: 'review: laptop unchanged', prompt: `${CTX}
# Your role: LAPTOP-UNCHANGED REFUTER (your Vite port: 5203; ALT server port 5213; scratch: ${SP}/mobile/work/review-laptop/; finding id prefix "L")
${REVIEW_RULES}

Phone mode's foundation has just been built on branch "mobile" in the worktree. The claim to attack: "on a laptop, and on any device that is not a phone, the game is exactly as it was before". Your job is to REFUTE it. Assume it is false until you fail to break it.

How:
- Find the base: the first commit on "mobile" that is not on origin/claude/krelworld-game is the safety net; everything after it is phone work. Read "git diff <safety-net-commit>..HEAD" for EVERY file outside src/game/mobile/ line by line: is every changed line a guarded hook, an import, or test/tool code? Is any guard wrong, missing, or evaluated in a way that changes order of execution, timing or object creation on desktop?
- Read the mobile module's entry points for side effects when isMobile() is false: module top-level code, listeners added, DOM added, CSS injected, prototypes or Phaser classes patched, timers started, storage read or written, per-frame polling. On a laptop all of that must be absent or provably inert.
- Attack the detection: touchscreen laptops, 2-in-1s, Chromebooks, Windows tablets with keyboards, iPads and Android tablets (must keep today's touch pad), Steam Deck, desktop browsers with a narrow window, desktop DevTools device emulation, TVs and consoles, foldables. Attack the override: can "?mobile=1" become sticky on a laptop in a way a normal player could trip? What does "?mobile=0" on a phone look like: exactly today's build?
- Run the recorded checks yourself: ${base.checkCommand} (must be byte-identical), "npx tsc --noEmit", "npx vitest run", the desktop assertions in scripts/mobile-smoke.cjs. Run the fingerprint check against the ALT dev server states too. Judge the safety net itself: what could change on a laptop WITHOUT the fingerprints noticing (sound, timing, input latency, storage, network, performance)? Probe those gaps directly (for example record listener counts, localStorage keys and requestAnimationFrame work on desktop before and after the phone commits by checking out the safety-net commit in a throwaway worktree under your scratch folder, removing it afterwards).
- Check both builds compile: production build of main and of ALT to a temp folder (delete after), and that isMobile() code does not break tree shaking or add anything that runs on desktop at startup.

Return every way you found in which a non-phone device differs, however small, plus weaknesses of the safety net that later stages should know about (as minor findings).` },
  { key: 'phone', label: 'review: blind phone play-test', prompt: `${CTX}
# Your role: BLIND PHONE PLAY-TESTER (your Vite port: 5204; scratch: ${SP}/mobile/work/review-phone/; screenshots to ${SP}/mobile/shots/ with names starting "s1-"; finding id prefix "P")
${REVIEW_RULES}

Phone mode's foundation has just been built on branch "mobile" in the worktree. Do NOT read the builders' reports (${REPORTS}/02-build1.md, 03-build2.md) before testing: judge what a player gets. You may read src/game/mobile/README.md only AFTER your first full play-through, to check claims against what you saw.

What stage 1 is supposed to deliver on a phone held sideways: the game detects the phone; a rotate-your-phone screen in portrait; the canvas centred; visible, comfortable walking controls in EVERY free-roam scene (a floating stick under the left thumb that also works when the drag starts in the black gutter, an ACTION button that appears with the right verb when something can be interacted with, a pause button), menus and dialogue still tappable, the game's old touch pad still working in combat (new combat controls come in stage 2), sound unlocking on the first tap, pausing when the tab is hidden, "?mobile=0" restoring today's behaviour exactly, "?mobilediag" showing diagnostics, and a readability switch ("?mobileread=1") that raises small text and tap targets (off by default for now), and an Add to Home Screen guide with the right steps for the browser in use (check it as an iPhone Safari user, an iPhone Chrome user, someone who opened the link inside Messenger or Instagram, and an Android Chrome user: would a non-technical friend manage it from the instructions alone?).

Test as a player, by real touch events only, on: iPhone 14 landscape (844x390, DPR 3), Safari-with-bars size (750x340), a small Android (740x360), a large phone (932x430), and portrait (390x844). Do at least this journey on the iPhone profile and spot-check the others:
1. Cold load in portrait, rotate to landscape; Enter gate; Title; NEW GAME; character select; difficulty; banter; the first scene (Home).
2. In Home: are the controls visible? Walk everywhere with the stick, starting drags in the play area, in the left gutter, and near the screen edge. Interact with every interactable in the room through ACTION and by tapping the object. Open and close pause. Watch the TV briefly, read the book, open the gun rack, the wardrobe, the fridge, the laptop.
3. Leave to the Hub: walk a long way, talk to an NPC, follow the objective, enter the Pub, the Club (the Wonky Pole), Kreddle, Polson Towers, the Exchange, the Venue, the Krunch Pit building; in each: visible controls, working ACTION, can you get back out?
4. Dialogue and meetings: every line advances by tap; choices can be tapped; nothing is swallowed by the layer; the layer hides when it should.
5. Enter a dungeon: the old pad must appear and work (move, attack, the special buttons), with no doubled or dead controls, and the new layer must not block it. Come back to the Hub: walking controls return.
6. Multi-touch: hold the stick and tap ACTION or pause with another finger; drop a finger outside the window; switch scene while holding the stick; rotate to portrait while holding the stick; hide the tab while holding it. Any stuck movement or stuck button is a finding.
7. Rotate to portrait mid-game (overlay, game paused, sound paused) and back; simulate visibilitychange hidden and visible.
8. "?mobile=0" on the phone profile: compare with the game before phone work (check out origin/claude/krelworld-game in a throwaway worktree under your scratch folder if you need a reference; remove it afterwards). "?mobilediag". "?mobileread=1": is small text now readable (measure CSS px), what overflows?
Measure, do not guess: read control sizes and positions from the DOM in CSS px (minimum 52, nothing in the bottom 21 px, inside safe-area insets), measure how much of the play area the controls cover, and measure rendered text heights. Comfort matters: where does the thumb have to travel, does anything sit under the thumb that should not, is anything fiddly?

Return every problem a real player would hit, with severity, exact reproduction and a screenshot path where useful.` },
  { key: 'robust', label: 'review: robustness and code', prompt: `${CTX}
# Your role: ROBUSTNESS AND CODE REVIEWER (your Vite port: 5205 if you need one; scratch: ${SP}/mobile/work/review-robust/; finding id prefix "R")
${REVIEW_RULES}

Phone mode's foundation has just been built on branch "mobile" in the worktree (read src/game/mobile/ in full, its README, the hooks outside it, the unit tests and scripts/mobile-smoke.cjs). Review it the way a senior engineer who has shipped mobile web games would. Look for real defects, with a failing scenario for each:
- Touch handling: touch id ownership, multi-touch, touchcancel, pointer capture, passive listeners versus preventDefault, ghost clicks and synthesized mouse events reaching Phaser twice, taps that should reach the canvas being swallowed (or reaching it twice), the stick zone blocking canvas buttons, stuck inputs when the mode changes, a scene shuts down, the overlay appears, the tab hides or the screen rotates mid-press.
- iOS Safari specifics: dynamic viewport units and the collapsing bars, rubber-band scroll, double-tap and pinch zoom, long-press callout and magnifier, text selection, the home-indicator area, notch insets in both landscape directions, audio unlock needing a user gesture that the layer must not swallow, no element fullscreen, orientation lock rejections, home-screen app mode, low-power mode throttling requestAnimationFrame.
- Android specifics: back-gesture zones at the left and right edges (a stick drag starting at the very edge), fullscreen and orientation lock promise rejections, leaving fullscreen, the address bar, visibility and pagehide, WebGL context loss on backgrounding (the game has a crash guard).
- Lifecycle: listeners and timers added per scene and never removed, the mode poll's cost, scale.refresh loops, the loop sleep and resume in every path (rotate while hidden, hidden while rotated), saving on pagehide, music and audio context resume, double initialisation on hot reload or bfcache restore.
- The settings store (storage disabled or full, corrupt JSON, schema growth), the readability mechanism (does the font floor compute from the real canvas scale, does it re-apply on resize, does it leak into laptop text, does the minimum hit size shift drawings or overlap neighbours), the hint helper (could it ever alter dialogue?), the diagnostics overlay (cost when off).
- A gamepad connected to a phone (clip-on controllers): do the touch controls get out of the way?
- Test quality: what do the unit tests and the smoke test NOT cover that could regress silently? Are any assertions vacuous?
- Design for the next stages: will the mode API, the control registry and the layout system support FIRE with slide-to-aim, DODGE, JUMP, a SMART button with a hold-radial, a weapon chip and a heal chip (audit section 3) without rework? Say what should change now, while it is cheap.

You may run things to confirm a suspicion (phone emulation with real touch events). Return only findings you can back with a concrete scenario.` },
]

const reviews = await parallel(lenses.map(l => () => agent(l.prompt, { label: l.label, phase: 'Review', schema: FINDINGS_SCHEMA })))
let findings = []
reviews.forEach((r, i) => { if (r && r.findings) for (const f of r.findings) findings.push({ ...f, lens: lenses[i].key }) })
const missing = lenses.filter((l, i) => !reviews[i]).map(l => l.key)
if (missing.length) log('Reviewers that returned nothing: ' + missing.join(', '))
log(`Review found ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blockers, ${findings.filter(f => f.affectsLaptop).length} affecting the laptop)`)

// ---------------------------------------------------------------- 4. Fix, then gate (loop)
const fixPrompt = (list, round) => `${CTX}
# Your role: FIXER, round ${round} (your Vite port: 5206; scratch: ${SP}/mobile/work/fix${round}/)

Independent reviewers examined the phone-mode foundation on branch "mobile" (read src/game/mobile/README.md and ${REPORTS}/ first). Their findings are below as JSON. Reviewers can be wrong: for EACH finding, first confirm it is real (read the code, reproduce it on an emulated phone or laptop as appropriate). Then:
- real -> fix it properly (root cause, not a patch over the symptom), and add or extend a test that would have caught it where that is practical;
- not real, or the reviewer misunderstood -> reject it with the evidence;
- real but belongs to a later stage (combat controls, menu layout sweeps, minigames, audio and memory) -> defer it with a note, and append it to ${REPORTS}/DEFERRED.md so that stage picks it up.
Anything with affectsLaptop true must be fixed now or disproved with evidence: it can never be deferred. Blockers must be fixed now.

Rules as always: laptop unchanged, containment, no dialogue changes, both builds. After fixing: ${base.checkCommand} green, "npx tsc --noEmit", "npx vitest run" and "node scripts/mobile-smoke.cjs" (see the README for its exact usage) all pass; commit with the required footer; leave the worktree clean. Update src/game/mobile/README.md where behaviour or API changed. Write ${REPORTS}/04-fix-round${round}.md.

Findings:
${JSON.stringify(list, null, 1)}`

const gatePrompt = (round) => `${CTX}
# Your role: FINAL GATE, round ${round} (your Vite port: 5207; ALT port 5217; scratch: ${SP}/mobile/work/gate${round}/)

You decide whether stage 1 of phone mode (branch "mobile" in the worktree) is safe to publish to the live game. You are independent: trust nothing in the reports, run everything yourself. Do not edit game code. (If a check script itself is broken you may say so as a blocker; do not fix it.)

Run and record:
1. Laptop: ${base.checkCommand} (byte-identical or FAIL), "npx tsc --noEmit", "npx vitest run", the desktop assertions (isMobile() false, no "mobile" class, no touch layer element, nothing new in localStorage, no new window/document listeners doing work), and read the diff of every file outside src/game/mobile/ since the safety-net commit: every changed line must be a guarded hook, an import or tooling. Play the laptop version for two minutes with keyboard and mouse (title, new game, home, hub, a dungeon room, pause): anything off is a blocker.
2. Both production builds: "npx vite build --outDir <temp>" and "VITE_KREL_ALT=1 npx vite build --outDir <temp>" (delete the output after); both must succeed.
3. Phone (iPhone 14 landscape profile and a small Android, real touch events): the smoke test passes; then play the first five minutes by touch yourself: boot, new game, Home (controls visible, walk, interact, pause), Hub, one interior, a dialogue, into a dungeon (old pad works), portrait overlay and back, hidden and back. No stuck inputs, no dead controls, no unreachable step. "?mobile=0" matches the game before phone work.
4. The worktree is clean and every commit message ends with the required two footer lines and contains no model name other than that footer line.

pass = true only if the laptop is provably unchanged AND a phone player can get from boot into the game and around it without a blocker. Return blockers with exact reproduction. Write ${REPORTS}/05-gate-round${round}.md.`

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

return { stage: 'foundation', base, b1, b2, findings, fixes, gate, rounds: round }

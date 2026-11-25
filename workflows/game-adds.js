export const meta = {
  name: 'krelworld-game-adds',
  description: "KRELWORLD: remove Mikey's collect quest, add an overworld bike (all versions), audit phone auto-fire; then gate",
  phases: [
    { title: 'Build', detail: 'game additions and the auto-fire audit in parallel' },
    { title: 'Review', detail: 'gate the game additions' },
    { title: 'Fix', detail: 'fix and re-gate if needed' },
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
- LIVE (branch claude/krelworld-game at 496f1066; local branch "mobile" in ${WT}): the phone version's stages 1-2 and the thumb-feel round. Stage 3 runs in two other workflows right now (branches s3-tap, s3-games, s3-scenes: do not touch their worktrees).
- THIS workflow handles three NEW requests from the user, on branches made from 496f1066:
  1. "Take out Mikey's collect quest" (ALL versions).
  2. "Audit the auto fire function to see if it makes dungeons too easy and consider alternatives that still feel good and not clunky on a phone" (PHONE).
  3. "Add a bike you can ride in the overworld to move more quickly (to all versions)" (ALL versions: laptop, phone, ALT).

## Hard rules
0. EXCEPTION for requests 1 and 3 ONLY: the user asked for these on ALL versions, so the laptop WILL change, but only by exactly these features. The laptop fingerprint will then differ in the states that show them: prove every difference is the intended feature (diff the fingerprint output and screenshots), and only then re-record the baselines in tests/fingerprints/ in ONE separate commit whose message says which states changed and why. Everything else on the laptop stays identical. Hard rules 1 and 2 (laptop unchanged, phone-only containment) are lifted for requests 1 and 3 only (the bike is ordinary game code in the game's own files, plus its phone button under src/game/mobile/); hard rule 3 (no dialogue changes) still applies. Request 2 is phone-only: hard rules 1 and 2 apply in full.
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


const AWT = SP + '/game-adds-wt'
const FWT = SP + '/autofire-wt'

const adds = () => agent(`${CTX}${SPEED}

# Your role: GAME ADDITIONS, ALL VERSIONS (worktree ${AWT}, branch "game-adds"; dev ports 5602 / ALT 5612; scratch ${SP}/mobile/work/game-adds/; screenshots ${SP}/mobile/shots/game-adds/; report ${REPORTS}/ga-01-adds.md)

## 1. Take out Mikey's collect quest
In src/content/arcs.ts, arc "arc_mikey" ("The Modulator"), remove the step id "lost_property" (kind "collect": passport, wallet, licence, bike batteries, headphone case around Krelford). Do NOT change any dialogue line anywhere (the first step's lines about losing everything stay: they still lead into phoning from the pub payphone). Arc progress is stored per step id, so saves stay valid: confirm that a save sitting on lost_property (some items picked up) moves on to "russian_hackers" cleanly, that no other code refers to that step (grep: map markers, quest log, collect spots in HubScene, tests, smoke, fingerprints, debug skips, the TV log), and the dungeon gate still opens when Mikey's required quest is done. Add a unit test.

## 2. A bike in the overworld (laptop, phone and ALT)
The user, verbatim: "Add a bike you can ride in the overworld to move more quickly (to all versions)". Design it to feel great, fit the game's pixel-art look and comedy, and never break anything. Defaults (change only with a reason in the report):
- WHERE: outdoor walking overworlds only (Krelford town / the Hub, and Kreddle's outdoor realm if it is a walking overworld). Never indoors, in dungeons, fights, minigames or cutscenes.
- GETTING IT: available from the start of a new game and in existing saves, parked outside Home; no shop or quest needed.
- ON / OFF: laptop key: pick a free key (B is taken by "Fizzy bongo" in keybinds.ts; check every binding; add it to the rebindable keys and the Controls/help screens) and a free gamepad button; phone: a BIKE toggle button in the walking controls (src/game/mobile, sized and placed per the phone layout rules; in walking scenes only, hidden while unavailable; the stick steers the bike; tap-to-use walks by bike when already riding). Using anything (talking, a door, a shop, the telly) gets off automatically and the bike is left there or simply returns (pick what plays best); going indoors dismounts; on-bike state never breaks saves (on foot after a load is fine).
- FEEL: about 1.8x walking speed with a little acceleration/braking so it feels like a bike, same collisions as walking (never through walls, NPCs, water), camera keeps up smoothly, a bell or freewheel sound when getting on (reuse an existing sfx or make a short one through ElevenLabs with header "xi-api-key: proxy-injected"; no voices).
- ART: pixel art matching the characters (PixelLab MCP tools are available via ToolSearch: e.g. create_map_object / create_1_direction_object / animate_object / create_character_state). Every playable character must look right riding it in every walking direction (4 or 8, matching their walk sprites). A composite (a bike sprite under the character's existing frames, legs hidden or pedalling) is acceptable if it looks good; show before/after screenshots in the report at 1x and the user-facing ones at 2x.
- First time: one short narrator/system tip naming the key (laptop) or the button (phone), through hint()/touchWording on phones. No new story dialogue.
- Performance: no measurable fps cost on the phone profile; phone texture parking (s3 wave 1, not on your branch yet) will just treat the bike as normal art.
Tests: unit tests (speed, on/off rules), a phone smoke section "bike" (mount by the button, ride across town by the stick, dismount on a door), and a laptop check script or test that rides with the key.

## Checks
At the end, the FULL check: ${CHECK(5602)} . Per hard rule 0: the fingerprint WILL differ where the bike or Mikey's quest shows; prove each difference is intended, then re-record the baselines in ONE separate commit (list the states). The touch-laptop/iPad/tablet profiles must also only differ by the bike. Write the report. Return JSON per the build schema.`, { label: 'adds: Mikey quest out, overworld bike', phase: 'Build', schema: BUILD_SCHEMA })

const AUDIT_SCHEMA = { type: 'object', properties: {
  verdict: { type: 'string' },
  measurements: { type: 'array', items: { type: 'object', properties: { scheme: { type: 'string' }, where: { type: 'string' }, result: { type: 'string' } }, required: ['scheme', 'where', 'result'] } },
  options: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, how: { type: 'string' }, pros: { type: 'string' }, cons: { type: 'string' }, built: { type: 'boolean' } }, required: ['name', 'how', 'pros', 'cons', 'built'] } },
  recommendation: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'smoke'] },
  notes: { type: 'string' } },
  required: ['verdict', 'measurements', 'options', 'recommendation', 'commits', 'checks', 'notes'] }

const audit = () => agent(`${CTX}${SPEED}

# Your role: AUTO-FIRE AUDIT, PHONE ONLY (worktree ${FWT}, branch "autofire"; dev ports 5622 / ALT 5632; scratch ${SP}/mobile/work/autofire/; screenshots ${SP}/mobile/shots/autofire/; report ${REPORTS}/ga-02-autofire.md)
The user, verbatim: "Audit the auto fire function to see if it makes dungeons too easy and consider alternatives that still feel good and not clunky on a phone".
1. Read how phone firing works now (src/game/mobile/combat.ts, combatLogic.ts, side.ts, the README's combat sections, reports s2-01..s2-04 and the research's M1) and how the laptop fires and aims (DungeonScene, Player, Guns: mouse aim? facing? hold to fire? ammo?).
2. MEASURE, don't guess: with deterministic stepping and a scripted "thumb" bot of realistic skill, play the same set on the laptop scheme (keyboard/mouse as a typical player) and on the phone (current default auto-fire): at least 3 top-down dungeon rooms across early/mid/late chapters, 2 bosses, and 2 side rooms. Per run: time to clear, damage taken, deaths, ammo used, kills, krezz/fart meter gain, how often the player never needed to aim. Repeat runs to get a fair spread. Conclude plainly: does auto-fire make dungeons easier than the laptop, by how much, and where.
3. Alternatives: consider at least these and any better ones from the research or comparable phone shooters (Brawl Stars, Archero, Soul Knight, Vampire Survivors, Enter the Gungeon mobile): (a) hold FIRE to shoot with aim assist (auto-aim only while held); (b) auto-fire only while standing still (Archero) ; (c) a right-hand aim stick that fires while dragged (twin-stick, Soul Knight) with tap-to-auto-target; (d) auto-fire kept but balanced (slower rate, needs facing/line of sight, no aim on enemies off-screen, ammo cost as laptop); (e) auto-fire with a lighter assist cone. Prototype the 2-3 most promising as phone Settings choices (Controls > Firing), measure them the same way, and judge feel by playing them by touch (comfort, clunkiness, two thumbs busy?). Do NOT change the default yet: the coordinator will ask the user. Recommend one default with numbers.
4. Phone only: the laptop stays identical (hard rule 1).
Tests for any logic you add; extend the smoke "combat" section for the new settings. At the end, the FULL check: ${CHECK(5622)}
Write the report (tables, plain English summary first). Return JSON per the audit schema.`, { label: 'audit: phone auto-fire', phase: 'Build', schema: AUDIT_SCHEMA })

phase('Build')
const [ad, au] = await parallel([adds, audit])
log(`adds ${ad && ad.ok}, audit: ${au && au.recommendation}`)

phase('Review')
const review = await agent(`${CTX}${SPEED}
# Your role: REVIEW AND GATE the game additions (worktree ${AWT} read-only except for throwaway servers; ports 5603 / 5613; scratch ${SP}/mobile/work/ga-review/; report ${REPORTS}/ga-03-gate.md)
Branch "game-adds" (from 496f1066): Mikey's collect quest removed and an overworld bike on all versions (report ga-01-adds.md). Do not edit files. Verify, trusting nothing:
1. Laptop: play as Mikey through his Modulator story from a fresh save and from a save sitting on the removed step: no softlock, no dangling marker, rewards intact, dungeon gate opens. No dialogue changed (git diff of every text file).
2. The bike on the laptop (key + pad), on the phone (button + stick, iPhone 14 with insets and 740x360, real touch) and in the ALT build: every playable character looks right in every direction; speed, collisions (walls, NPCs, water, map edges), doors, talking, shops, cutscenes starting while riding, chapter changes, saving/loading while riding, the TV, fast tap-to-use; nothing gets stuck.
3. The fingerprint baseline commit: every changed state is explained by the bike or the quest; nothing else on the laptop changed (compare a laptop session against 496f1066 in a throwaway worktree with cp -al node_modules, removed after).
4. ${CHECK(5603)} ; production builds main and ALT succeed (temp folder, deleted).
Return JSON per the gate schema (pass only if nothing is broken and the laptop differs only by the requested features).`, { label: 'gate: game additions', phase: 'Review', schema: GATE_SCHEMA })

let fix = null, gate2 = null
if (review && !review.pass) {
  phase('Fix')
  fix = await agent(`${CTX}${SPEED}
# Your role: FIXER for the game additions (worktree ${AWT}; ports 5606 / 5616; report ${REPORTS}/ga-04-fix.md)
Confirm each blocker, fix the root cause, re-record fingerprint baselines only if the fix changes the intended features' look (separate commit, explained), then ${CHECK(5606)}. Commit (footer), worktree clean.
Blockers:
${JSON.stringify(review.blockers, null, 1)}`, { label: 'fix game additions', phase: 'Fix', schema: FIX_SCHEMA })
  gate2 = await agent(`${CTX}${SPEED}
# Your role: RE-GATE the game additions after fixes (worktree ${AWT}; ports 5607 / 5617; report ${REPORTS}/ga-05-regate.md)
Re-check the blockers below are fixed and re-run ${CHECK(5607)} plus production builds. Do not edit files.
${JSON.stringify(review.blockers, null, 1)}`, { label: 're-gate game additions', phase: 'Fix', schema: GATE_SCHEMA })
}
return { adds: ad, audit: au, review, fix, gate2 }

export const meta = {
  name: 'krelworld-donut',
  description: "KRELWORLD (all versions): Job Centre toilet opens without clearing the room; a SanChz jam donut cutscene with art",
  phases: [
    { title: 'Build', detail: 'gate removal and cutscene art' },
    { title: 'Review', detail: 'gate' },
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
- LIVE (branch claude/krelworld-game at 0da900db): the phone version's stages 1-2. Other workflows run right now on branches s3-tap, s3-games, s3-scenes, game-adds, autofire, aim and sfx: do NOT touch their worktrees.
- Your branch "donut" is made from "game-adds" at 4b8355bd (Mikey's collect quest removed, an overworld bike; fingerprint baselines re-recorded for the bike). It will ship after game-adds.
- THIS workflow handles a NEW request from the user, for ALL versions (laptop, phone, ALT). Verbatim:
  "Remove the bit in the job center where you have to kill everything to talk to Sanchez. And add a cutscene of him shagging a jam donut. You don't need to show any genitals just show him moaning holding a jam donut to his groin area. Add small pixelation or censor bar if necessary but what's happening should be clear"

## Hard rules
0. EXCEPTION for this request: it is for ALL versions, so the laptop WILL change, but only by exactly this feature. If the laptop fingerprint differs, prove every difference is this feature, then re-record only those baselines in ONE separate commit whose message says which states changed and why. Everything else on the laptop stays identical. Hard rules 1 and 2 are lifted for this feature only (ordinary game code in the game's own files). Hard rule 3 (dialogue) is relaxed ONLY as stated in your role below.
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


const DWT = SP + '/donut-wt'
const build = () => agent(`${CTX}${SPEED}

# Your role: THE JOB CENTRE TOILET (worktree ${DWT}, branch "donut"; dev ports 5682 / ALT 5692; scratch ${SP}/mobile/work/donut/; screenshots ${SP}/mobile/shots/donut/; report ${REPORTS}/dn-01-donut.md)
The place: chapter 5, the SanMikverse dungeon, room "Job Centre Plus (Catford Branch)" in src/data/dungeons.ts (exitFlag "sm_donut", a STAFF TOILET (ENGAGED) talker prop with action "donut") and DungeonScene.ts: useTalker case "donut" (it refuses until this.roomCleared: "ENGAGED. ... Clear the Job Centre first.") and donutScene() (dialogue only today: SanChz with a jam donut in the staff toilet).
1. REMOVE THE GATE: the toilet can be opened at any time, with no need to kill everything first. Remove the refusal (its two lines go: that is the requested change). Make it safe mid-fight: enemies and projectiles freeze or the scene clears them while the cutscene plays (use whatever the game already does for talk() mid-room; check the San Brothers, hazards, crushers and movers), nothing hurts the player during or right after it (a short grace period), and nothing softlocks: decide whether the room's exit still needs the waves cleared after the scene. Default: the exit opens once the scene has played AND the waves are done, exactly as now, but if the room's exit only waited on the toilet because of the gate, keep the waves as the normal room fight. Also check the exitHint text still makes sense (it is a hint, leave the words unless it now lies). Every other line of the scene stays word for word.
2. THE CUTSCENE ART (the new part): while donutScene's lines play, show a full-frame pixel-art illustration (like the game's other vignettes/cutscene backdrops: find how they are done, e.g. backdrops, vignette panels, PixelLab art in public/art) of SanChz in the transformed Job Centre staff toilet (tealights on the cistern, rose petals in the sink, a small speaker) holding a jam donut to his groin, eyes closed, moaning with pleasure. He stays CLOTHED (trousers on): no genitals at all. Add a small censor bar or pixelation over the donut/groin as a comic touch; what is happening must still read clearly (the hold, the face, little hearts / "YEGHHH" / motion lines / a drip of jam). It is comedy, cartoonish, not explicit. Match SanChz's existing look exactly (find his sprite and portrait: SanBrother.ts, the San Brothers' art, his talking portrait) and the game's art style. Animate it with a few frames or tweens (a rhythmic sway, the moan, hearts popping, the tealight flicker) so it plays as a cutscene, synced to the lines: e.g. the reveal on "And there is SanChz...", the moan on "The donut moans in pleasure", SanMik bursting in. Use the PixelLab MCP tools (via ToolSearch: create_image_pro / create_image_pixflux / edit_image / animate_image / inpaint_image etc.; check get_balance first; keep generations reasonable). If a tool refuses a prompt, rephrase in plain clothed, comedic terms ("a man in a bathroom, fully clothed, holding a jam donut in front of his trousers, eyes closed, blissful expression") and add the censor bar yourself in code. Never sexualise anyone who looks young; SanChz is an adult man.
3. SOUND: his moans use ONLY his existing recorded voice clips ("yegh"/YEGHHH lines; Voice.ts maps SANCHZ to "yegh"): you may play existing clips (pitched, timed) but NEVER generate a new line in his voice and never clone or imitate a real voice. Slow-jam music: reuse an existing track or the game's synth. Any new non-voice effect (creak, squelch) may come from ElevenLabs sound effects (header "xi-api-key: proxy-injected"), no voices.
4. Phone: the art fills the landscape screen correctly on the phone profile (iPhone 14 landscape with insets, 740x360) and the dialogue boxes do not cover the key part of it; laptop at 960x540 as usual; ALT build too.
5. Tests: a unit or smoke check that the toilet opens mid-fight, the scene plays with the art and finishes, the exit opens as designed, and the repeat visit ("We don't talk about it") still works.
At the end the FULL check: ${CHECK(5682)} (per hard rule 0: re-record only the states this feature changes, in one separate commit; the bike baselines are already in). Commit (footer), worktree clean. Report: plain English first, with paths of 2x screenshots of the cutscene (laptop and phone) for the user. Return JSON per the build schema.`, { label: 'donut: toilet gate out, cutscene art', phase: 'Build', schema: BUILD_SCHEMA })

phase('Build')
const b = await build()
phase('Review')
const gate = await agent(`${CTX}${SPEED}
# Your role: REVIEW AND GATE the Job Centre toilet change (worktree ${DWT} read-only except throwaway servers; ports 5683 / 5693; scratch ${SP}/mobile/work/donut-review/; report ${REPORTS}/dn-02-gate.md)
Builder's result: ${JSON.stringify(b)}
Verify on laptop, phone (iPhone 14 landscape, real touch) and ALT: the toilet opens mid-fight with no damage or softlock; the cutscene art shows SanChz clearly (matches his look), clothed, no genitals, a small censor bar/pixelation, and what is happening reads clearly; it is synced with the lines and plays smoothly; the repeat visit works; the exit and waves behave as the report says; no dialogue changed except the removed refusal (git diff of every text file); no new voice line was generated in his voice. Then ${CHECK(5683)}; production builds main and ALT succeed (temp folder, deleted). Return JSON per the gate schema (laptopUnchanged = laptop differs only by this feature).`, { label: 'gate: toilet cutscene', phase: 'Review', schema: GATE_SCHEMA })
let fix = null, gate2 = null
if (gate && !gate.pass) {
  phase('Fix')
  fix = await agent(`${CTX}${SPEED}
# Your role: FIXER for the Job Centre toilet change (worktree ${DWT}; ports 5686 / 5696; report ${REPORTS}/dn-03-fix.md)
Confirm each blocker, fix the root cause, then ${CHECK(5686)}. Commit (footer), worktree clean.
Blockers:
${JSON.stringify(gate.blockers, null, 1)}`, { label: 'fix toilet cutscene', phase: 'Fix', schema: FIX_SCHEMA })
  gate2 = await agent(`${CTX}${SPEED}
# Your role: RE-GATE the Job Centre toilet change (worktree ${DWT} read-only; ports 5687 / 5697; report ${REPORTS}/dn-04-regate.md)
Earlier blockers: ${JSON.stringify(gate.blockers)}
Fixer: ${JSON.stringify(fix)}
Confirm each is fixed, then ${CHECK(5687)}. Return JSON per the gate schema.`, { label: 're-gate toilet cutscene', phase: 'Fix', schema: GATE_SCHEMA })
}
return { build: b, gate, fix, gate2 }

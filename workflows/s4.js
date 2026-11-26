export const meta = {
  name: 'krelworld-phone-stage4',
  description: 'KRELWORLD phone stage 4: full phone QA (two blind players + platform), fix rounds, and a final gate on branch s4',
  phases: [{ title: 'QA' }, { title: 'Fix' }, { title: 'Gate' }],
}
const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const WT = SP + '/mobile-wt'
const UI_WT = SP + '/mobile-ui-wt'
const TWT = SP + '/s3-tap-wt'
const PWT = SP + '/s3-perf-wt'
const S4 = SP + '/s4-wt'
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
- LIVE (branch claude/krelworld-game at 8b337a45) now has stages 1-3 of the phone version: walking, combat (HOLD FIRE by default, which aims all round at enemies you can see; EASY in Settings auto-fires), menus, dialogue, lists, tap to use, every minigame and special scene by touch, TV captions paged, the iPhone audio route and the phone sound mix, texture parking, perf caps, pause routes; plus all-version features (bike, Mikey's quest removed, the Job Centre toilet cutscene, Shezleigh's new voice).
- THIS workflow is STAGE 4: full phone QA of the whole game, fixes, and a final gate. Your worktree is ${S4} on branch "s4" (from live 8b337a45). Another session may push separate content branches (music-gaps, cut-flashbacks): ignore them.
- Known open items carried into stage 4 (reports in ${REPORTS}/: s3-05-gate-round1.md, s3-09-merge.md, ga-03-gate.md, dn-02-gate.md, ga-08-aim-fix.md, DEFERRED.md):
  - P6 Whack title card and P7 Krunch Pit board overflow with Bigger text (on by default on phones); P9 Wonk-Off has no II pause and starts 0.9 s after its last line; P11 load-game rows run under the trash icon; P12 Beep Beep BOOST/BRAKE cover the MPH readout.
  - The smoke's "Firing LIGHT" pace checks fail (LIGHT is a hidden style no longer offered in Settings): fix the check or retire it honestly, with a reason.
  - Flaky timing checks: review1 P2 pit, side coyote, SWAP/chip tap, HEAL tap under load. Make them robust if the cause is the test (not by loosening a real requirement), or prove the game is wrong and fix it.
  - DEFERRED R3: Back twice in town leaves the page (Android back gesture).
  - TV started from the Hub makes the headless renderer's memory spike (2.6-3.7 GB); check what a phone would see and reduce it on phones if it is real.
  - Bike nits (all versions, ordinary game code allowed for the bike): a Kreddle shove does not get you off the bike; the bike layers trail the rider by a frame; the phone bike button can flicker on a long frame hitch.
  - iOS 16 (no navigator.audioSession): no fallback for sound on silent.

## Hard rules
0. Stage 4 is PHONE-ONLY work: hard rules 1-3 apply in full. The single exception is the bike (an all-version feature): its nits may be fixed in its own game files; if that changes a laptop fingerprint state, prove the difference is only the bike fix and re-record only those baselines in ONE separate commit that says which states and why. Nothing else may change a laptop baseline.
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
- 4 CPUs, 15 GB RAM, about 8 GB disk free. Up to two other agents run at the same time as you (disk: about 8 GB free, keep scratch small) (heavy load: expect slowness; never treat a timing failure under load as proof of a bug without re-running it once).
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
const QA = [
  { key: 'early', port: 5801, file: 's4-01-play-early.md', role: `BLIND PHONE PLAYER, the first half. You are a first-time player on an iPhone 14 held sideways (844x390, DPR 3, the smoke test's iPhone profile with safe-area insets 47/47/21, real touch). Use only what is on screen: never read the code to find out how to do something before you have tried it the way a player would. Start a NEW GAME from the Enter gate and play as far as you can through chapters 1 to 3 in about 90 minutes of agent time: Home (TV, gun rack, wardrobe, book, fridge, console), the town on foot and on the bike, tap to use, conversations, the Krezz Arms, shops, the Kreddle Exchange, side quests, the first dungeons and their bosses, every minigame you meet, pause and Settings. Use DebugSkip / Chapter Select only to get past something you are truly stuck on (say so). Also try the 750x340 Safari-with-bars size for 10 minutes.` },
  { key: 'late', port: 5821, file: 's4-02-play-late.md', role: `BLIND PHONE PLAYER, the second half, and the ALT build. You are a player on a small Android phone (740x360, DPR 3, the smoke test's Android profile, real touch) and on a large phone (932x430). Use Chapter Select (password "krunt") or DebugSkip to reach chapters 4 to 7, the SanMikverse (including the Job Centre toilet), Crobley's factory and the side-scrolling rooms, Kreddle and its raid, the Club and the Venue, the late bosses, the roof and the Krelford finale and the ending. Play each for real with touch as a player would (fight, jump, use specials, read dialogue, pause, resume). Then spend about 20 minutes on the ALT build (VITE_KREL_ALT=1 on port ${5821 + 10}) checking the same kinds of scenes there.` },
  { key: 'platform', port: 5841, file: 's4-03-platform.md', role: `PLATFORM AND ROBUSTNESS. iPhone and Android profiles, real touch. Check and try to break: (1) lifecycle: lock/unlock (visibilitychange + pagehide/pageshow), background mid-fight, mid-minigame, mid-dialogue and mid-TV; rotating to portrait and back in each; (2) Android Back gesture (history) in town, menus, fights (DEFERRED R3: Back twice in town leaves the page); (3) saves: autosave, reload, continue, the load-game list, two save slots; (4) memory: a 25-stop walk over home, town, TV shows from Home AND from the Hub, Kreddle, three dungeons, two bosses, the finale; report window.__krelMobile.art.report() and the renderer's memory where you can, and whether the TV-from-Hub spike is real on a phone profile; (5) sound: the audio route on the iPhone profile, the fight mix, no double music, pause holds the song, iOS 16 without navigator.audioSession (simulate by deleting it before boot); (6) the in-app browser card, ?mobilediag, the Add to Home Screen guide on both phones and in standalone mode; (7) go through the "Known open items" list in the context and say for each whether it reproduces, with evidence.` },
]

const QA_RULES = `
## Your job in this run (read-only QA)
- Work in a THROWAWAY worktree you create from branch s4: "git -C ${S4} worktree add --detach ${SP}/mobile/work/s4qa-KEY-wt s4" (replace KEY with your key), symlink node_modules from ${S4}, run your dev server(s) from there on your own port(s), and remove the worktree when done. Never edit ${S4}.
- You FIND problems; you do not fix them. A finding needs: what a player sees, exact repro (device profile, how you got there, taps), a screenshot path where it helps, a severity (blocker: a phone player is stuck, loses progress, or a crash/softlock; major: clearly broken, unreadable, unreachable or very frustrating; minor: cosmetic or rare), and whether it could affect the laptop (it never should).
- Re-run anything timing-related once before reporting it (the machine can be slow). Say if a finding is only under load.
- Also note what works well, briefly, so the fixer does not break it.
- Write your report to ${REPORTS}/FILE and return the findings. Stop your servers and remove your throwaway worktree.`

const FIX_ROLE = (findings) => `
## Your job: STAGE 4 FIXER (round {{ROUND}})
Work in ${S4} on branch s4 (commit there; never push). Fix, in priority order:
1. Every blocker and major in the findings below.
2. The "Known open items" in the context that the findings confirm or do not cover (P6, P7, P9, P11, P12, the Firing LIGHT checks, the flaky timing checks, Back twice, the TV-from-Hub memory if real on phones, the bike nits, iOS 16 sound on silent if a safe fallback exists without lock-screen controls; otherwise defer it with the reason).
3. Minors that are cheap and safe.
Reject a finding with evidence if it is not real; defer only with a reason. Keep every fix phone-only and guarded (hard rules 1-3), except the bike nits (hard rule 0). Add or update unit tests and smoke checks for what you fix. Update src/game/mobile/README.md and ${SP}/mobile/DEVICE_CHECKLIST.md where behaviour changed. Write ${REPORTS}/s4-{{NUM}}-fix.md.
When done, run the FULL check once: ${CHECK(5861)}

The findings (JSON):
${JSON.stringify(findings, null, 1)}`

const GATE_ROLE = `
## Your job: STAGE 4 GATE (round {{ROUND}})
Independently verify branch s4 in ${S4} (read-only: do not commit; create a throwaway worktree from s4 if you need to run servers, and remove it after). Decide pass/fail:
- Laptop unchanged: the full CHECK below must be green (fingerprint halves, profiles, desktopInvariants, unedited protected files: index.html, src/main.ts, vite.config.ts, tests/fingerprints/ and tests/desktopInvariants.test.ts, unless a bike-only baseline commit exists and you have verified every difference in it is the bike). Diff s4 against live 8b337a45 outside src/game/mobile/, tests/ and scripts/ and check every hunk is a guarded phone hook or a bike fix.
- Dialogue: no character line added, removed or reworded (script-compare every say/dir/talk string in the diff).
- The fixes: re-run each fixed finding's repro on the phone profiles and confirm it is fixed; check nothing near it regressed.
- Phone smoke on main and ALT: green, or every remaining failure proven pre-existing on live 8b337a45 or a load-only timing failure that passes on one re-run.
- Production builds main and ALT succeed (temp folder under ${SP}/mobile/work/, deleted after).
Write ${REPORTS}/s4-{{NUM}}-gate.md. The full CHECK: ${CHECK(5881)}`

phase('QA')
const qa = await parallel(QA.map(q => () => agent(CTX + SPEED + `\n## Your role: ${q.role}\n` + QA_RULES.replace(/KEY/g, q.key).replace('FILE', q.file) + `\nYour ports: ${q.port} (and ${q.port + 10} for ALT).`, { label: `qa: ${q.key}`, phase: 'QA', schema: FINDINGS_SCHEMA })))
const all = qa.filter(Boolean).flatMap((r, i) => (r.findings || []).map(f => ({ ...f, from: QA[i] ? QA[i].key : '?' })))
log(`${all.length} findings: ${all.filter(f => f.severity === 'blocker').length} blocker, ${all.filter(f => f.severity === 'major').length} major, ${all.filter(f => f.severity === 'minor').length} minor`)

let gate = null, fix = null, fixes = [], gates = []
let todo = all
for (let round = 1; round <= 3; round++) {
  phase('Fix')
  const num = String(3 + round * 2 - 1).padStart(2, '0')
  fix = await agent(CTX + SPEED + FIX_ROLE(todo).replace(/\{\{ROUND\}\}/g, String(round)).replace(/\{\{NUM\}\}/g, num), { label: `fix round ${round}`, phase: 'Fix', schema: FIX_SCHEMA })
  fixes.push(fix)
  phase('Gate')
  const gnum = String(3 + round * 2).padStart(2, '0')
  gate = await agent(CTX + GATE_ROLE.replace(/\{\{ROUND\}\}/g, String(round)).replace(/\{\{NUM\}\}/g, gnum) + `\n\nThe fixer's report (JSON):\n${JSON.stringify(fix, null, 1)}`, { label: `gate round ${round}`, phase: 'Gate', schema: GATE_SCHEMA })
  gates.push(gate)
  if (gate && gate.pass) break
  todo = (gate && gate.blockers || []).map(b => ({ id: b.id, severity: 'blocker', title: b.title, detail: b.detail, affectsLaptop: b.affectsLaptop }))
  if (!todo.length) break
}
return { stage: 'stage4', qa, findings: all, fixes, gates, pass: !!(gate && gate.pass), head: gate && gate.headCommit }

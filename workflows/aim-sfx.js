export const meta = {
  name: 'krelworld-aim-sfx',
  description: "KRELWORLD phone: hold-FIRE + 35° cone as the default firing, and find why dungeon sound effects were silent on the user's phone",
  phases: [
    { title: 'Build', detail: 'firing default and the sound investigation in parallel' },
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


const AIMWT = SP + '/aim-wt'
const SFXWT = SP + '/sfx-wt'

const SFX_SCHEMA = { type: 'object', properties: {
  rootCause: { type: 'string' }, evidence: { type: 'string' },
  fixedOnWave1Already: { type: 'boolean' }, fixedOnWave2Already: { type: 'boolean' },
  commits: { type: 'array', items: { type: 'string' } }, whatUserShouldCheck: { type: 'string' },
  checks: { type: 'object', properties: { tsc: { type: 'boolean' }, vitest: { type: 'boolean' }, fingerprint: { type: 'boolean' }, profiles: { type: 'boolean' }, smoke: { type: 'boolean' } }, required: ['tsc', 'vitest', 'fingerprint', 'profiles', 'smoke'] },
  notes: { type: 'string' } },
  required: ['rootCause', 'evidence', 'fixedOnWave1Already', 'fixedOnWave2Already', 'commits', 'whatUserShouldCheck', 'checks', 'notes'] }

const aim = () => agent(`${CTX}${SPEED}

# Your role: PHONE FIRING, THE USER'S CHOSEN DEFAULT (worktree ${AIMWT}, branch "aim" made from "autofire" at 204e8c85; dev ports 5642 / ALT 5652; scratch ${SP}/mobile/work/aim/; screenshots ${SP}/mobile/shots/aim/; report ${REPORTS}/ga-05-aim.md)
The audit agent may still be finishing on branch "autofire" (its report is written); do not touch ${FWT}. Reuse its bench: ${SP}/mobile/work/autofire/bench.cjs and bot.js (copy into your scratch folder if you change them).

The user's complaint about the live phone game: "It was both auto firing and auto aiming. It was so easy". Their decision ("1 and 4 sound good"). Build exactly this, phone only:
1. NEW PHONE DEFAULT, "Firing: HOLD": the gun fires only while the thumb holds FIRE (no shooting by itself). While held, aim assist turns the shot onto an enemy ONLY if it lies within about 35 degrees either side of where the player faces / the stick points (the aim direction a laptop player would have from movement); otherwise the shot goes straight along that direction. The assist never locks onto an enemy that is off screen (a big boss counts as on screen when ANY part of its body is visible, not only its centre) or behind a wall / out of line of sight. Keep the existing "slide FIRE to aim by hand" if it already works (optional extra, not required). Side rooms (side-scrollers): the same rule (hold FIRE; assist only within the cone ahead; facing left/right, up/down where the game allows). Keep DODGE, SPECIAL, READY, the pocket buttons and everything else as they are.
2. "Easy aim": the old behaviour (auto-fire + full aim assist, today's AUTO) stays as a Settings > Firing choice for players who want it, named so a player understands it (e.g. HOLD (default) / EASY). Drop LIGHT and STILL (the audit showed they only make it harder and feel worse). Old saves/settings: a player who never changed the setting gets the new default; a stored choice of AUTO from before this change also moves to HOLD once (version the setting) since nobody chose AUTO knowingly before Firing existed... unless the store shows they explicitly picked it in Settings > Firing (that row has never been live, so in practice everyone moves to HOLD).
3. TEACH IT: the phone's first fight shows a one-time system/narrator tip (through hint()/touchWording, phone only, no dialogue change) such as "Hold FIRE to shoot." The FIRE button must look like the thing to hold (check its label/icon and the existing first-time cues in combat.ts).
4. TUNE WITH NUMBERS: with the audit's bench (same rooms, bosses, side rooms and seeds as ga-02), measure HOLD-with-cone against the laptop scheme and against old AUTO: damage dealt per second, damage taken per minute, clears, deaths, time to clear, ammo used, % of shots that hit. Aim: roughly laptop-level difficulty (within about 10% either way on damage dealt and taken), clearly harder than old AUTO, and bosses no slower than the laptop. Try cone half-angles of 25, 35 and 45 degrees and keep 35 unless the numbers clearly say otherwise; report the table. Also judge FEEL by touch on iPhone 14 landscape with real touch events: hold FIRE with the right thumb while steering with the left; dodge and come back to FIRE; does it feel clunky? Fix anything awkward (e.g. a hold that drops when the thumb slides a little, a FIRE button too small or too far from DODGE).
5. Tests: unit tests for the cone/line-of-sight/on-screen rule and the setting migration; update the smoke "combat" section (default is HOLD: no shot without a hold; a held FIRE shoots; an enemy 60 degrees off-axis is not targeted; an enemy behind a wall is not targeted; EASY still auto-fires).
6. Phone only: laptop identical (hard rules 1 and 2). README section updated.
At the end the FULL check: ${CHECK(5642)}
Commit (footer), worktree clean. Write the report: plain-English summary first (what the player gets, the numbers vs laptop and vs old AUTO), then details. Return JSON per the build schema.`, { label: 'aim: hold FIRE + 35° cone default', phase: 'Build', schema: BUILD_SCHEMA })

const sfx = () => agent(`${CTX}${SPEED}

# Your role: "NO SOUND EFFECTS IN THE DUNGEON" ON PHONES (worktree ${SFXWT}, branch "sfx" made from the LIVE commit 0da900db; dev ports 5662 / ALT 5672; scratch ${SP}/mobile/work/sfx/; report ${REPORTS}/ga-06-sfx.md)
The user, on their own phone with the LIVE game: "There weee no sound effects in dungeon." (We do not yet know if it was an iPhone or Android, whether the ringer/silent switch was on, or whether voices and music played; the coordinator is asking them.) Find the root cause, trusting nothing.
1. Read every sound path (src/game/audio/Synth.ts, Voice.ts, sfxList.ts, the dungeon/combat scenes, guns, the phone module src/game/mobile/ on the LIVE commit). On a phone in a dungeon: which sounds should play (gunshots, hits, enemy deaths, explosions, pickups, fart blaster, the crunch bus), and through which graph? Does the phone combat controller (auto-fire, FIRE button, aim.ts, combat.ts) fire guns through a path that skips the sound (e.g. calling a lower-level fire function, a muted flag, a "silent" auto-fire, the 160 ms let-go)? Does anything in phone mode lower, mute, suspend or disconnect the effects bus (settings, pause/resume, visibility, the shell's audio unlock/hold, heldAudio, fullscreen changes, the rotate overlay)? Are effects created before the AudioContext is unlocked and then lost? Does a scene change in or out of a dungeon suspend the context and never resume it?
2. Instrument a real phone session in Playwright (iPhone 14 landscape and a small Android profile, real touch): enter from the title by touch like a player, walk to and into a dungeon, fight (by the default auto-fire and by holding FIRE). Count calls into the sound layer (synth.play etc.), check AudioContext state, the gain values along the effects path (sfxGain, master, any phone nodes) and that nodes reach the destination; also record the audio output (e.g. an AnalyserNode / MediaStreamDestination tap, or OfflineAudioContext style capture) to prove effects actually produce signal in the dungeon. Compare with the laptop profile. Do the same on branch s3-tap (wave 1: pooled audio, audioSession) and s3-games (wave 2 merged: the phone sound mix) in throwaway worktrees (git worktree add --detach, cp -al node_modules, removed after) to see if they already fix it.
3. iPhone silent switch: on iOS Safari, Web Audio is silenced by the ringer switch while <audio> elements (music) keep playing, unless navigator.audioSession.type = 'playback' (Safari 17+) or a fallback (e.g. a silent looping <audio> element started in a tap) puts the page in the media category. Check what LIVE does (likely nothing), what wave 1 does (src/game/mobile/audio.ts applySession on s3-tap), and whether older iOS (16) also needs a fallback. Voice lines are Web Audio too, so if voices were also silent this is the likely cause; say so.
4. If you find a bug that wave 1 / wave 2 do not already fix, fix it on branch "sfx" (phone only: guarded hooks; laptop identical), with a unit test and a smoke check that proves effects produce signal in a dungeon on the phone profile. If the fix belongs in a file wave 1/2 rewrote (src/game/mobile/audio.ts), make it a small, separate commit that will merge cleanly and say so. If nothing needs fixing beyond what wave 1/2 do, commit nothing and say exactly what the user should check on their phone.
5. If you changed code, the FULL check at the end: ${CHECK(5662)}
Write the report (plain English first: what was wrong, on which phones, and when the fix reaches them). Return JSON per the sfx schema.`, { label: 'sfx: no effects in dungeon on phone', phase: 'Build', schema: SFX_SCHEMA })

phase('Build')
const [am, sx] = await parallel([aim, sfx])
log(`aim ${am && am.ok}; sfx: ${sx && sx.rootCause}`)

phase('Review')
const gate = await agent(`${CTX}${SPEED}
# Your role: REVIEW AND GATE the phone firing default (worktree ${AIMWT} read-only except throwaway servers; ports 5643 / 5653; scratch ${SP}/mobile/work/aim-review/; report ${REPORTS}/ga-07-aim-gate.md)
Branch "aim" (report ga-05-aim.md): the phone default became hold FIRE with aim assist only within about 35 degrees of facing, no lock off screen or behind walls; the old auto-fire is an EASY choice. ${sx && sx.commits && sx.commits.length ? 'Also review branch "sfx" in ' + SFXWT + ' (report ga-06-sfx.md): a phone sound fix.' : ''}
Do not edit files. Verify by playing by touch (iPhone 14 landscape with insets, 740x360 Android, real touch events): no shot without holding FIRE; holding fires; the assist only inside the cone; nothing off screen or behind walls is targeted; bosses with a part on screen can be hit; side rooms; EASY still works; the tip shows once; the setting migrates; a first-time player understands they must hold FIRE. Re-run a few of the bench's fights to confirm the reported numbers are reproducible. Then ${CHECK(5643)}; production builds main and ALT succeed (temp folder, deleted). Return JSON per the gate schema (pass only if nothing is broken, it is clearly harder than old AUTO and not clunky, and the laptop is unchanged).`, { label: 'gate: firing default', phase: 'Review', schema: GATE_SCHEMA })

let fix = null, gate2 = null
if (gate && !gate.pass) {
  phase('Fix')
  fix = await agent(`${CTX}${SPEED}
# Your role: FIXER for the phone firing default (worktree ${AIMWT}${sx && sx.commits && sx.commits.length ? ' and, for sound findings, ' + SFXWT : ''}; ports 5646 / 5656; report ${REPORTS}/ga-08-aim-fix.md)
Confirm each blocker, fix the root cause, then ${CHECK(5646)}. Commit (footer), worktrees clean.
Blockers:
${JSON.stringify(gate.blockers, null, 1)}`, { label: 'fix firing default', phase: 'Fix', schema: FIX_SCHEMA })
  gate2 = await agent(`${CTX}${SPEED}
# Your role: RE-GATE the phone firing default after fixes (worktree ${AIMWT} read-only; ports 5647 / 5657; report ${REPORTS}/ga-09-aim-regate.md)
Earlier blockers: ${JSON.stringify(gate.blockers)}
Fixer: ${JSON.stringify(fix)}
Confirm each blocker is fixed by touch, then ${CHECK(5647)}. Return JSON per the gate schema.`, { label: 're-gate firing default', phase: 'Fix', schema: GATE_SCHEMA })
}
return { aim: am, sfx: sx, gate, fix, gate2 }

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

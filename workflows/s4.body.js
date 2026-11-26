
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

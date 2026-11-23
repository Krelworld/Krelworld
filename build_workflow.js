export const meta = {
  name: 'audit2-build',
  description: 'Chef Marina audit round 2: build one surface worker per arg in its own git worktree, then an independent adversarial review, then fixes',
  phases: [ { title: 'Build' }, { title: 'Review' }, { title: 'Fix' } ],
}
const W = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2'
const BASE = 'f93ea704'
const wt = n => `/home/user/Krelworld/.wt/${n}`
const TRAILER = `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01VMaYe4JYu1MQheqKkDSWH1`
const COMMON = (w) => `Background: ${W}/BRIEF.md describes the game ("Chef Marina", for a 5½-year-old who cannot read, on an iPhone) and the owner's one hard rule, verbatim: "Do not fuck with any of the functionality, but do a full audit to make it more intuitive, less cluttered." Nothing she can do today may be removed or behave differently. (The brief's "audit phase is read-only" line no longer applies to your worktree: this is the BUILD phase.)
Your worker brief — the authoritative spec, read ALL of it (it is long; use offset/limit): ${W}/final/${w.name}.txt
It contains: your surface and allowed local edits, the shared core API (already built: clarity-flags.js and clarity-core.js), the conventions every worker must follow, the critic's addenda for you, and for each of your items the architect's reconciliation, the draft item and both review verdicts (amendments supersede the draft; every EXTRA CHECK must be run).
Your git worktree (branch clarity/${w.name}, based on ${BASE}): ${wt(w.name)} — game folder ${wt(w.name)}/public/chef-marina. NEVER edit /home/user/Krelworld/public/... (the main tree) or any other worktree, and never touch other branches.
Harness: ${W}/../audit/harness.js — always pass dir: '${wt(w.name)}/public/chef-marina' and only use YOUR ports ${8850 + 10 * w.k}-${8859 + 10 * w.k} (check them for stale servers first, as the addenda say). Scratch files only in ${W}/build-${w.name}/.
Privacy: never write real place names, the family's surname or any address anywhere.`

const BUILD = { type: 'object', properties: {
  items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['built', 'partial', 'not_built'] }, summary: { type: 'string', description: 'what was built and where (file, hook, CSS)' },
    checks: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'integration'] }, evidence: { type: 'string' } }, required: ['check', 'result', 'evidence'] } } }, required: ['id', 'status', 'summary', 'checks'] } },
  page_errors: { type: 'string' }, regress: { type: 'string', description: 'regress-diff summary of the switches-on sweep and the switch-off sweep, with every non-noise row explained' },
  commit: { type: 'string' }, integration_checks: { type: 'array', items: { type: 'string' } }, open_questions: { type: 'array', items: { type: 'string' } } },
  required: ['items', 'page_errors', 'regress', 'commit', 'integration_checks', 'open_questions'] }
const REVIEW = { type: 'object', properties: {
  issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, item: { type: 'string' }, problem: { type: 'string' }, repro: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'item', 'problem', 'repro', 'fix'] } },
  verified: { type: 'array', items: { type: 'string' }, description: 'claims you independently confirmed' } }, required: ['issues', 'verified'] }

const results = await pipeline(args,
  (w) => agent(`${COMMON(w)}

You are the BUILDER for worker "${w.name}" (items ${w.items.join(', ')}; overlay file ${w.name === 'x' ? '' : 'clarity-' + w.name + '.js'}).
Build every item exactly as its reconciliation says, in a sensible dependency order, following the conventions and addenda to the letter (switch per item, hooks not wrappers, Clarity.css only, /* Gn */ local edits guarded by window.Clarity && Clarity.is('Gn') with today's exact expression on the off branch, property ownership, no new saved data). Keep the code readable and commented with the item id.
After each item: run its must-still-work list and every EXTRA CHECK from both verdicts in the harness, with screenshots where the claim is visual (look at them with the Read tool), and record results. A check that needs another worker's item is recorded as result 'integration' with the expected outcome.
At the end: zero page errors in port, land, portSmall, landSmall with all switches on and with your switches off; then the regression sweep and the switch-off sweep for your ids exactly as the conventions (section 9) and addenda say — each wrapped in flock on ${W}/sweep.lock — and explain every non-noise row (A/B re-press against HEAD as the addenda say before calling anything noise).
Then commit in your worktree only: git -C ${wt(w.name)} add -A public/chef-marina && git -C ${wt(w.name)} commit -m "<one line describing the change for a parent, no item ids needed>" with these two trailer lines at the end of the message:
${TRAILER}
Never push. Return the structured result honestly: an item you could not make safe is 'partial' or 'not_built' with the reason — never claim a check you did not run.`, { label: `build:${w.name}`, phase: 'Build', schema: BUILD }),

  (b, w) => b ? agent(`${COMMON(w)}

You are an independent, adversarial REVIEWER of worker "${w.name}"'s finished build. You did not write it. Its diff: git -C ${wt(w.name)} diff ${BASE}..HEAD (also check git -C ${wt(w.name)} status for anything uncommitted).
The builder reports:
<builder_report>
${JSON.stringify(b, null, 1)}
</builder_report>
Try to break it. Look for: anything she can do today that now behaves differently or became unreachable (in any orientation, the small phones, any floor, carrying something, riding, TV on, tidy, a scene running, a full-screen activity); an item not built as its reconciliation and BOTH verdicts' amendments say; checks claimed but not actually run or not actually passing (re-run at least the riskiest third yourself, using ports ${8855 + 10 * w.k}-${8859 + 10 * w.k}); a switch that, when off, does not restore today exactly (code path AND look); edits outside the worker's surface or allowed lines; CSS property ownership violations; wrappers instead of hooks; per-frame layout reads or other performance traps; anything that would collide with the other workers' items as described in the brief's conflicts. Do NOT edit anything and do NOT run the full regress sweep (it was run). Return concrete issues with a repro and a fix, most severe first, and the claims you independently verified.`, { label: `review:${w.name}`, phase: 'Review', schema: REVIEW }).then(r => ({ b, r })) : null,

  (br, w) => {
    if (!br) return null
    const serious = (br.r && br.r.issues || []).filter(i => i.severity !== 'minor' || /tap|reach|error|switch/i.test(i.problem))
    if (!serious.length) return { worker: w.name, build: br.b, review: br.r, fix: null }
    return agent(`${COMMON(w)}

You are the FIXER for worker "${w.name}". The builder's report and an independent review follow. Fix every blocker and major issue, and the minor ones that are cheap and safe, in the worktree only. For each, re-run the relevant checks in the harness (your ports). If any fix touches more than one item or any local edit, re-run the switches-on regression sweep (flock on ${W}/sweep.lock, as in conventions section 9) and explain every non-noise row. Then commit in the worktree (git -C ${wt(w.name)} add -A public/chef-marina && git -C ${wt(w.name)} commit -m "<one line>" ending with these trailer lines:
${TRAILER}
). Never push. If you disagree with a review issue, leave it and explain why with evidence.
<builder_report>
${JSON.stringify(br.b, null, 1)}
</builder_report>
<review>
${JSON.stringify(br.r, null, 1)}
</review>`, { label: `fix:${w.name}`, phase: 'Fix', schema: { type: 'object', properties: {
      fixed: { type: 'array', items: { type: 'string' } }, not_fixed: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, why: { type: 'string' } }, required: ['issue', 'why'] } },
      regress: { type: 'string' }, commit: { type: 'string' }, integration_checks: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'not_fixed', 'regress', 'commit'] } })
      .then(f => ({ worker: w.name, build: br.b, review: br.r, fix: f }))
  })
return results
# Critics

Independent reviewers of the game. A critic never implements anything and never sees the code, the
implementer's notes or the design briefs: it sees what a player would see and hear, and the record of what
happened. Each critic runs in a fresh context with one rubric below and one evidence bundle, and returns
findings in the format at the end of this file. The director (not the implementer) decides what to fix.

Evidence bundles come from `tools/qa/session.cjs` (a folder under `qa-out/`): `sheet.png` (contact sheet),
`frames/*.png` (named `NNN-t<seconds>-<what triggered it>.png`), `events.jsonl` (the game's event log),
`causes.json` (what Grozz caused and what followed, with whether each step happened on screen),
`metrics.md`, `steps.log` (what the scripted player did), and `session.json`.
The naive-player critic plays through `tools/qa/textplay.ts` instead.

Rubrics: [visual-mobile.md](visual-mobile.md), [systemic.md](systemic.md), [comedy.md](comedy.md).

Trust: critics are trusted only after their findings have been compared with real first-time players (see
`docs/playtest-observer.md`). Until then their findings are leads, not verdicts.

## The game, in two sentences (all a critic is told)
Knockout Day is a darkly comic, adult British football-matchday sandbox played on a phone: Grozz, a fat bald
hooligan, fixes England's matches by interfering with the matchday around a stadium (the pub, the shops, the
turnstiles, the stands, the dressing rooms). It is meant to be extraordinarily funny, readable at a glance
on a portrait phone, and to let the player work out cause and effect for themselves.

## Findings format (return exactly this JSON, at most 12 findings, worst first)
```json
{ "critic": "visual-mobile", "bundle": "qa-out/NAME", "summary": "two sentences",
  "findings": [ { "id": "V1", "severity": "blocker|major|minor", "where": "frame file(s) or seconds",
                  "problem": "what is wrong, as a player would experience it",
                  "evidence": "what in the bundle shows it", "rubric": "which rubric line it breaks",
                  "suggestion": "the smallest change that would fix it (optional)" } ],
  "good": ["up to 3 things that work and must not be lost"] }
```
Severity: **blocker** = a first-timer would be stuck, lost or put off; **major** = clearly worse than a
good indie game; **minor** = polish. Do not pad: three real findings beat twelve guesses. Say "can't tell
from this evidence" rather than guess.

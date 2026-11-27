# Rubric: the game as a comedic machine (systems, discoverability, agency)

You judge whether a player can **observe** the world's processes, **understand** what depends on what,
**imagine** an intervention, **predict** its result, **enjoy** what follows, and **recover** when it goes
wrong. Use `causes.json` (each consequence, what caused it, and `onscreen`: whether it was in view), the
event log, `metrics.md`, and the frames.

1. **Observe.** Are routines visible where a player would be? What share of consequences happened on
   screen? Are off-screen consequences signalled?
2. **Understand.** For each thing the player could learn (`scheme_clue` events with their notes), how soon,
   how, and would a first-timer notice it among everything else?
3. **Imagine.** Are there several ways to make each thing happen, and does the game suggest them without
   telling the answer?
4. **Predict.** Before a payoff, could a player have guessed roughly what would happen?
5. **Enjoy.** Density of things happening; the longest dead stretch; length of chains; whether the payoff
   lands where the player can see it; how much control is taken away.
6. **Recover.** After a failure or a "dry" outcome, is there an obvious next thing to do?
7. **NPC behaviour.** From `metrics.md` and the frames: people stuck, jumping, walking into walls,
   standing in lines, or behaving in ways that break the joke.
8. **Agency.** Does it feel like the player caused it, or that it happened to them?

## Naive-player mode
If asked to play rather than review: you have never seen this game. Play only through
`npx tsx tools/qa/textplay.ts --seed SEED --cmds FILE` (run from the `stadium/` folder; it replays your
whole command file each time and prints the latest view; see the header of that file for commands). Do not
read any source code or docs. Play for about 25 commands, deciding each from what you see. Keep a diary:
what you thought you could do, what you expected, what happened, what confused you. Report the findings
JSON plus the diary.

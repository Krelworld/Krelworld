# Decisions

## Engine: Phaser + TypeScript (stage 0)

The same scene (pitch, 22 players, 300 crowd, joystick, sound on tap) was built in
both engines. Sources are in `enginetest/`.

| | Phaser 4 | Godot 4.4 web export |
|---|---|---|
| Download (compressed) | ~0.4 MB | ~9.4 MB |
| Download (raw) | 1.4 MB | 43.7 MB |
| Headless Chromium, software rendering | 58 fps | 40-44 fps |
| Can be tested automatically in this environment | Yes (Node + headless browser) | Export only |
| Simulation runnable outside the browser | Yes (plain TypeScript in Node) | No |

Phaser was chosen. The deciding factors were the download size on phones, and
that the simulation can be plain TypeScript which runs in Node for thousands of
automated matches. Real-phone frame rates are still to be confirmed by hand.

## Structure

- `src/core` is engine-independent and deterministic: all state is plain data,
  all randomness comes from seeded streams, time advances in fixed 1/60 s steps.
  That gives checkpoints (clone the state) and recordable player actions.
- `src/football` is the match simulation, also engine-independent.
- `src/view` is the Phaser layer. It only reads state and sends inputs.

## Units

Metres and seconds. The pitch centre is the world origin. The pitch is about
68% of real size (72 x 46) so the stadium stays walkable.

## Football simulation (stage 2)

Every player is an individual agent; outcomes come from positions and attributes.
Things that physically happen (ball over the line, a foul, an offside position)
become candidates. Only an official's ruling changes the score, cards or restart.

Measured over batches of 60 full matches, England v Portugal, 7.5-minute halves:

| | England wins | Opponent wins | Draws | England goals | Opponent goals |
|---|---|---|---|---|---|
| No interference | 21 | 24 | 15 | 1.37 | 1.32 |
| Their star striker arrested before kick-off | 36 | 9 | 15 | 1.40 | 0.58 |
| Their goalkeeper bribed | 40 | 8 | 12 | 2.47 | 1.03 |
| Referee bribed towards England | 40 | 11 | 9 | 2.27 | 0.83 |
| Against Brazil, no interference | 11 | 30 | 19 | 1.00 | 1.53 |

Known gaps: few offsides (about 0.2 a match) and throw-ins, no advantage rule,
no dropped balls, half-time is a short pause rather than a playable phase.

## Running it

- `npm test` runs the automated tests.
- `npm run stats -- 40 ENG POR` plays 40 matches without graphics and prints totals.
  Add `--sabotage=star`, `keeper` or `ref`, and `--league` to allow draws.
- `npm run build` builds the viewer into `dist/viewer` (open `local.html` through a local web server).

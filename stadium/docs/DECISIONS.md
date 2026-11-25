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

## Stadium slice (stage 3)

One stadium, one quarter-final against Portugal, about 25-30 minutes of real time:
5.5 minutes before kick-off, two 7.5-minute halves, 2.5 minutes of half-time,
extra time and penalties if level.

What runs by itself: supporters arriving (some via the pub), turnstile queues,
stewards at posts, a door guard who props the staff door open for a smoke every
few minutes, a beer lorry looping pub yard -> ring road -> service gate -> loading
bay, police patrols, teams and officials walking between dressing rooms and the
pitch, half-time drinks.

Ways in (all covered by tests): buy a ticket; buy one off a supporter; pickpocket
one; bribe a turnstile steward; jump the turnstile; hide in the beer lorry; wear a
hi-vis vest past the staff door; slip in while the door is propped open.

Security: stewards and police see in a cone with line of sight. Suspicion builds
from being somewhere you don't look allowed, carrying a weapon openly, or
matching a description. Responses: watch, approach, warn and walk you out,
eject (ticket cancelled, contraband confiscated to the security office, face
barred), detain in the security office (police called for serious crimes),
arrest. Minor offences only matter to staff; assaults and theft are noticed by
anyone. Incidents are blamed on whichever team's shirt you were wearing until a
steward pulls the outer shirt off.

Effects on the match come only from the world: thrown objects distract or stun
whoever they hit; spiked team water or the referee's tea takes effect in the next
half; bribes change a player's or referee's behaviour; a pitch invasion halts play
if the referee notices.

Checkpoints: arrival, first time inside, kick-off, half-time. Loading one re-rolls
the match.

Not yet: betting shop, footballer and referee impersonation on the pitch, police
impersonation, the team bus, the dog, vertical routes, sound, real art.

Running: `npm run build` then open `dist/stadium/local.html` through a local web
server. `npx tsx tools/stadium-sim.ts` runs a whole match day with nobody playing.

## Art and sound test

PixelLab, v3 characters, low top-down view, black outline: the fan, a steward,
an England player, a Portugal player and the referee, each with 8 directions and
an 8-frame walk in all 8 directions. Two 32px top-down tilesets (grass/concrete
and road/pavement). About 60 generations in total.

Findings:
- 64px characters are about 56px tall: at crisp 1x zoom a phone shows ~27 m of
  stadium. The game currently shows ~40 m. 48px characters fit the current view
  and stay readable. Leaning 48px for the game, 64px for close-ups.
- The standard tilesets' transitions are rounded blobs, wrong for stadium edges;
  a later pass needs straight-edged tiles (pro mode or hand-placed).
- The pitch tileset came back with its two terrains swapped in the metadata.

ElevenLabs: 12 sound effects and 13 voice lines (library voices "Daniel - Steady
Broadcaster" for the tannoy and "Northern Terry" for stewards; cloned voices on
the account were avoided). Wired in with Web Audio: a crowd bed that changes with
where you are, match and hit sounds, tannoy lines with a chime, steward shouts.

Assets live in `assets/art` and `assets/audio`; raw API responses in `assets/raw`.

## Tournament and new systems

- Venues: the semi-final ground is the quarter-final one mirrored, with a fan zone,
  a catering van, metal detectors, face cameras, staff passes and a loose fence
  panel. Opponents: Portugal, then Brazil.
- Carry-over: money, kept items (not tickets, slips or food) and notoriety, which
  rises with ejection, being unmasked, serious incidents seen, and detention.
  Notoriety 1: barred and described to stewards; 2: posters and an extra officer.
- Planting and tip-offs; a police uniform in the van for fake arrests; containers
  can be emptied, including the confiscation locker.
- The opposition team bus runs from a hotel across the service road. Tampering
  causes a crash (injuries, a delayed kick-off). Driving it into people blames
  their team (a forfeited goal) until the driver is identified, which reverses it.
- The dog: untie, lead, release; it bites, scatters people and stops play.
- Kits in the dressing-room hampers: wearing one on the pitch adds you to that
  team as a player-controlled footballer; the referee eventually counts twelve.
- Movement: walk 3 m/s, run 5.4 m/s for about seven seconds before you are winded.
  Zoom is 23 screen pixels per metre at 1x, matching 48px character art.

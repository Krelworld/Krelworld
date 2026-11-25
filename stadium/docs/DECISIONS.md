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

## Kick-off delays and breaches

- Kick-off is a check, not a time. At the scheduled moment it waits 45 s if: a
  fire alarm is ringing; a wall has just been knocked through (once, "safety");
  three or more of either side are outside the ground, down or still on the bus;
  a team has just been in a coach crash (once); the referee is unfit (twice, then
  the fourth official takes over); or the pitch has an intruder, a loose dog or
  smoke on it. Each delay has its own tannoy line.
- Every delay raises a security level (0–5); a breach raises it by two. Stewards'
  suspicion builds faster and they see further at higher levels.
- After six delays the referee starts regardless. A side with fewer than seven
  able players forfeits. England can go through without a ball kicked, but it
  takes keeping most of their team out of the ground for about five minutes.
- When the team has to wait for its bus at kick-off, it gives up and walks.
- Fire alarm call points (five per ground, one use each) delay kick-off, halt live
  play for 15–35 s (shorter each time) and make stewards less watchful while the
  bell rings. Pulling one is a minor offence only staff care about.
- Bus into a wall at over 8 m/s (about 18 mph), if the wall is 2.5–4.5 m high and
  not a gate: a 5.6 m hole, a wrecked bus, the driver dazed for a few seconds,
  passengers hurt as in a crash, a severity 3 crime blamed on the bus's team
  unless the driver is seen, and police heading for the hole. Above 12.2 m/s
  there is a 15% chance of a hospital ending. Slower, the bus just bounces off.
  Holes are saved in the state; walls, paths and sight lines all use the walls
  with the holes cut out.

## Dog commands, knives, driving views, crowds

- The dog on a lead can be set on one person ("sic"): it paths round walls, bites three
  times (a steward holding you lets go at the first), leaves an injury and comes back to
  heel. Footballers get one of eight injuries, some of which they play on with. Setting
  it on an official or steward is severity 3. Stewards can still catch it.
- At a turnstile with the dog: "He's a service dog. For my autism." Works 75% at the
  quarter-final, 50% at the semi-final, less as security rises; one try per steward.
- A sharp weapon kills. Security staff facing you who are already after you may disarm
  you (40%). Killing leaves you bloody (alarming) until you change your outer top.
- Bodies: take the face (wearable; onlookers see that person's face, so bans, cameras
  and wanted descriptions follow the face you wear; close up it's noticed) or the hands
  (a staff member's hands work the palm reader on the semi-final staff door).
- A seen killing, or a body found by anyone, calls armed police: 40 s later 4–6 officers
  from the police van hunt the last known position. If they identify you, they challenge
  once; empty hands and standing still = arrested; otherwise they fire every half second
  (hit chance falls with distance and running). Misses can kill bystanders.
- Driving views: Chase (default) and Cab are a pseudo-3D renderer in the manner of the
  Krelworld Pseudo3D projector; Map is the old view. In 3D views the stick is wheel and
  pedals (Actor.drive), not a compass direction. Juice from Krelworld's DriveScene: shake,
  flash, streak callouts, flung bodies, blood and cracks on the windscreen.
- Crowd: up to 240 walking supporters plus 70 already seated and 26 pub regulars. Most
  mill about the pub, approach and car park until a personal time, then surge in.

## Pseudo-3D (standing note)

The game mixes the tilted diorama with pseudo-3D moments, in the manner of Krelworld's
Pseudo3D projector and its Beep Beep driving game. Built: the bus cab and chase views.
Candidates, roughly in order of payoff:
- An establishing flyover of each ground as the match day starts.
- The dog's-eye charge when you set Tyson on someone.
- A first-person pitch invasion: the run at the referee, Beep Beep style, stewards diving at you.
- Goal replays on the big screen from behind the goal; penalties from the taker's eye.
- CCTV control-room feeds as low-res pseudo-3D monitors.
- Driving the beer lorry or catering van; the armed-response helicopter's spotlight shot.

## Beep Beep in the bus

Taken from Krelworld's BeepBeepScene: the horn (everyone ahead freezes, so they can't dive),
pedestrians who decide once whether to dive for the gutter (55% fans, 40% others) or stand
there, the "DOUBLE BUMP!" combo callouts and the shouting, the two-sawtooth engine, the
hit-stop, the field of view opening out with speed, and speed streaks.

## Tyson

A pit bull: lunges to the end of his rope or lead at anyone within 4.5–6 m, snapping, with
hackles up; people near you on the lead back off. Growls, savage barks and gnashing are
separate sounds. Bigger on screen than a generic dog.

## Krelworld art as a stopgap: not used

Krelworld's pixel art is its own cast (characters from that world) at a different scale and
palette; mixing it in would look like a crossover rather than a stopgap, and the figures here
are drawn by code, so using sprites means building the sprite pipeline anyway. That pipeline
is better spent on the 48px PixelLab art already chosen.

## Workable art (stopgap)

The game now draws people with the PixelLab sheets from the art test (fan, steward, England,
Portugal, referee; 8 directions standing, 8 x 8 walk frames). Colours are swapped at load time
by colour band and body region, so the one fat fan is every supporter, local, barman, cleaner
and the player in any disguise; the steward is also police and armed officers (with a drawn
helmet); Portugal's sheet becomes Brazil. Hats, masks, glasses and blood are drawn over the
sprite. The stands are filled with cropped seated fans facing the pitch. Paving, tarmac,
concrete and pitchside grass use the PixelLab tiles. Walls, vehicles, items and the dog are
still drawn in code. The 3D driving views still use simple shapes.
Drawing order: each wall, item and overlay goes into graphics layers interleaved with the
sprites in depth order, so walls still hide people behind them.

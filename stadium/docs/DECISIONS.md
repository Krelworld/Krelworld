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

## The world as pictures (batch 1: outside)

Buildings and props are PixelLab map objects ("low top-down", so you see shopfronts), placed on
their real footprints and depth-sorted with people. The generator's lettering is gibberish, so
sign boards are repainted at load time in a 5x7 pixel font. A building fades to show its inside
when you walk in, and goes see-through when you're behind it. The stadium from outside is a
ring of corrugated roofs with a club-blue fascia over a clad facade, the turnstile block and
floodlights; all of it fades once you're inside the ground. The coach and beer lorry are
eight-direction PixelLab objects (the coach tinted in the team's colour). The charity shop and
army surplus doors moved to the road side so their fronts face the camera.

## Phone interface

One message on screen at a time (the rest is in the menu's log); people's chatter stays in their
speech bubbles. The red button hides when there's nothing to do, uses short words, and a red
ring shows what it would act on. A goal line under the score ("Get into the ground"); the place
name shows briefly when you arrive somewhere. Gold coins over anyone selling, red marks over
anyone coming for you. Touch devices get a short intro without keyboard keys and start at 1.5x.
Speech bubbles stay the same size whatever the zoom.

## Art direction: realistic, not storybook

The game should look more real than Krelworld's storybook style. A test with the same generator
and a prompt asking for muted natural colours, true-to-life proportions, overcast light and
grime (assets/world-tests) gets much closer: a flat-roofed estate pub, a shuttered bookies.
When the PixelLab plan refreshes, regenerate the buildings, the street and the stadium inside
with that prompt (isolated objects: the realistic pub came back with a painted street behind
it), and the characters with realistic proportions and several body types.

## Interface: match-day television

The HUD is styled as football coverage: a score bug (team colour bars, white score, yellow
clock), caption straps for the tannoy and commentary, angled red action button, condensed
capitals throughout (Barlow Condensed, with Barlow for running text), sharp-cornered navy
panels, programme-style intro and full-time cards. In-world labels and speech bubbles use the
same face.

## One pixel, one camera (the look, rebuilt)

Something wasn't working about the world, and research into games that do this well (The
Escapists 1 and 2, Stardew Valley, Eastward; Slynyrd's pixel-art guides; MDN and the Phaser
forum on crisp pixel art) points to two causes: the art came at several pixel densities
(sprites, 12 px/m buildings, tiles) scaled by non-whole amounts, and three different camera
angles (squashed floor, side-on pictures, top-down tiles). Those games use one grid, one
three-quarter camera and whole-number scaling, with Escapists-style cutaway rooms.

So now:
- **32 art pixels to the metre for everything**, drawn 1:1. Characters (about 60 px tall) at
  scale 1; PixelLab floor tiles (32 px = 1 m, laid at random from their variants so the repeat
  is 8 m); street furniture, furniture and dressing generated at 32 px/m.
- **One projection**: a square floor (no depth squash) with upright faces, one metre up the
  screen per metre of height. Light from the top left; shadows fall to the bottom right.
- **The canvas draws at the screen's real pixels** (device pixel ratio up to 3) and the camera
  zooms in whole steps, so every art pixel is the same size and text in the canvas is sharp.
  Phones start at about 22 points per metre to show more of the street; bigger screens at 32.
- **Walls are textured faces with a cap**, cut down low (1.1-1.6 m) so you see over them, in
  brick, London stock, blockwork, cladding, render, portakabin ribbing or timber.
- **Buildings are drawn, not pictured**: a front (brick or render, sash windows, a pub's tiled
  ground floor and gold-lettered fascia, painted shopfronts with goods in the windows, awnings,
  hanging baskets, the doors in their real gaps) and a roof (slate with a ridge and chimneys,
  felt with plant, ribbed steel). Walk in and the roof lifts off: the inside is a cutaway room
  with furniture (pool table, fruit machine, telly, pumps; rails; shelving; screens; lockers,
  kitchen, desks). Solid furniture is in the layout, so nobody walks through it.
- **The ground from outside**: a corrugated roof ring, clad facade with the ground's name on the
  fascia, fixture banners and St George crosses, turnstile doors; floodlights on the roof.
- Items on the floor show as their icons. Trees, a statue, litter, puddles, bin bags, cones and
  pallets make the street look used. A palisade fence and more pavement past the map's edge.

Still to do: the coach and lorry are older art at a lower density (drawn at 3x); the cast is
still one fat-fan body recoloured; inside the stadium wants tiers, dugouts and boards.

## The angle, researched properly (docs/research-visuals.md)

A survey of twenty comparable games (Escapists, Streets of Rogue, Party Hard, Hotline Miami,
GTA 1/2 and Chinatown Wars, Prison Architect, Stardew, Eastward, Gungeon, Untitled Goose Game,
Monaco, Project Zomboid, HD-2D and others) confirms the three-quarter oblique view at 32 px/m with
~60 px people. Top-down loses faces and uniforms (Monaco's developer dropped it for that reason);
isometric hides more behind walls, costs draw-order headaches and turns the pitch into a diamond
on a landscape phone; HD-2D reads cosy, not grim. The oblique view's weakness is occlusion, so:
your silhouette shows through any wall, roof or van that hides you, and occluders fade.

## Violence that lands

Following the research (hit-stop is the strongest single factor in how combat feels; sound
coherence and camera framing next): a blow knocks its victim back about a metre and a half in
the simulation (walls still stop them), they flash white, recoil (PixelLab hit animation), then
fall (fall animation, last frame is how they lie). Blood sprays along the blow and the drops land
as spots that stay all day; the badly hurt bleed a spreading pool. Your own blows stop the world
for 55/90/140 ms (jab/weapon/knockout), add camera trauma (shake = trauma squared, smooth noise,
whole pixels) and kick the camera along the punch; knockouts and killings drop to 0.3x speed for
a moment. Sounds: a swing, one of three meaty impacts or a hammer crack, a crowd "ooh", the body
hitting the floor. A red vignette when you're the one hit. Victims swear. Bystanders form a ring,
shout, film it on their phones (with the odd flash) or back away.

## The cast

PixelLab characters with realistic proportions: the fat fan (now with punch, kick, hit and fall),
his shirtless state (take your shirt off and the sunburnt belly and St George tattoo come out), a
skinny lad, a woman fan, an old boy in a flat cap, a big lad in a Stone Island jacket, a club
official in a suit, a proper British police constable, and the steward (hit and fall). Fans are a
mix of all of them, recoloured for either side; the seated crowd uses three bodies. Shopkeepers
look the part (Rose is a woman, Sarge is a big lad, Lionel wears a suit).

## Atmosphere

An overcast colour grade (a little desaturated, a little more contrast) and a faint vignette over
everything, which also pulls the generated sprites together; light drizzle outdoors; the seated
crowd fidgets and rises in the end the ball is attacking.

## No camera behind the player (docs/research-camera.md)

Asked directly: would a pseudo-3D view from behind the character be better? Researched, and no,
not as the main view. A chase camera sees a ~78° wedge ahead (we measured our own driving view);
this game is about reading a crowd and spotting who's coming for you, mostly from behind and the
sides. Behind-camera crowd games (Hitman, Watch Dogs) need radar, suspicion meters, wall X-ray and
a second thumb for the camera to get that information back; Square Enix's phone Hitmans dropped
the free camera, and Rockstar went back to near-overhead for GTA on the DS's small screen. Our
sprites are drawn from above, so from behind they'd tip back and break the one-pixel rule.
Behind and close-up cameras are for moments: driving (done), and later the tunnel walk-out, a
pitch-invasion run-in, knockout replays.

The overhead view's real weakness is the edges (about 9 m above and below you on a phone), so:
arrows at the screen's edge point to anyone coming for you (red) and the loose dog (yellow); the
camera leads further in the direction you're going and leans toward pursuers; on a phone it steps
in one zoom level during a fight and back out after. The zoom button's far step is the overview.

## Voices and crowd (ElevenLabs, stock voices only)

Fight lines and bystander shouts are voiced in stock British voices (a woman says the female
take), never cloned voices. The ground sings now and then ("Eng-er-land" with a drum, slow
clapping that builds); near misses get an "ooh"; the pub has its own din; armed police come with
a siren.

## The pub cubicle

Step into the pub's toilet cubicle and the view cuts to a close-up of the partition wall (a
PixelLab picture with the hole, chalked phone numbers and "DAZ WOZ ERE" painted over it). Knock
on the hole (tap it, or the button) and a camp voice next door asks "Want some fun?". Say yes
and something comes through under a black CENSORED bar. With a knife on you (hand or pocket)
you can chop it off: a slash, a scream, a fountain of blood that spurts in pulses, stains the
wall, runs, and splats across the view; you come out bloody, with a Censored bar in your pocket
(uses to come). Afterwards, knocking only gets whimpering. Say no, or back away, and he's
offended. It runs on a `hole` verb (knock / yes / no / chop / leave) so it's tested like the rest.

## Skint

You start with £40, and a ticket is £60. Find the money (bets, wallets) or another way in. Sarge
at the army surplus now sells a knife (£25), so the stall's other option is reachable from the
street.

## Cinematic moments (agreed, to do)

Behind and close-up cameras for moments only: the tunnel walk-out, a pitch-invasion run-in, and a
close-up on a big knockout. Driving already has one.

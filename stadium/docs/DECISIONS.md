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

## Alive

The street was a stage set: people stood like statues between walks and nothing else moved.
Now:
- **People do things.** Fans and locals hang about in groups (up to five, facing each other),
  and each is doing something: drinking (and dropping their empties), smoking, chatting (with
  voiced chatter), cheering, or just breathing. PixelLab animations for every body: idle, drink,
  smoke, chat, cheer; stewards and police talk into their radios now and then.
- **Traffic.** Cars on the ring road, driving on the left: black cabs, a white van, hatchbacks,
  a police car (lights going once the police are called). They stop for anyone in the road and
  honk if you stand there. Arriving fans now come off the far pavement and cross through it.
- **A mounted officer.** PC Hargreaves is on a horse.
- **Small life.** Pigeons pecking round the litter that scatter when anyone comes near; smoke
  from the burger van; drizzle rings in the puddles; breath steaming in the cold; a crisp packet
  blowing across the approach.
- **The stands.** The seated crowd puts its arms up for goals (their own side), near misses and
  attacks at their end, and a few at random; photographers behind the goals fire their flashes
  when anyone shoots.
- **Moments.** Letterbox, a push-in and slow motion for a big knockout ("SPARKO"), walking out of
  the tunnel, and running onto the pitch while the game's on.

## Sandbox pass (docs/research-sandbox.md)

The complaint: too much empty space, too few ways to scheme, fighting awkward. The research says
those share one cause: the area outgrew the content. Hitman builds "Swiss cheese" (connections
per volume), Escapists and Goose keep levels small and full, and every room gets two or three
exits with one of them naughty. Verdicts:

- **No radical redesign of the bowl.** The ground, the routes and 100+ tests depend on it. We
  shrank the playable outside instead and filled what's left.
- **First person: optional, not the main view.** The research is against free-roam first person
  for a systemic top-down sandbox (you lose the read of who's watching). It's in as a toggle
  (V, or the 1P button): a Doom-style raycaster over the same walls, with eight-way sprites as
  billboards and your fists at the bottom.

## Combat that's easy

- **Tap to hit, auto-target.** You swing at the nearest person in reach and turn to face them;
  reach is a little longer than before.
- **From behind is a takedown.** If they're facing away it's a silent chokehold: down at once,
  no noise, no knockback. Face to face it's a brawl: hits stagger, the third or fourth knocks
  them out, and fans and locals hit back.
- **Knocked out and dead.** Knocked out lasts about fifty seconds, then they come round angry
  (security radio it in). Stamp on a man who's down and he's dead.
- **Pockets.** Anyone down can be searched: money, and whatever they'd plausibly carry
  (powder, a knife, a ticket, a staff pass). Seen doing it, it's a crime.
- **Bodies.** Drag them (you're slow), put them in a bin or a private room. Hidden bodies never
  wake. Left in the open, someone finds them: "Man down!", and security come.
- **You get hurt too.** Five hits and you're out: you lose half your money, and inside the
  ground the first-aiders stretcher you to the medical room (which is next to the dressing
  rooms).

## The horse

Pull PC Hargreaves off his horse (from beside him), climb on, and gallop. Anyone in front goes
over; at full gallop they stay down. Low walls (barriers, counters, turnstiles) get jumped, high
ones stop you. Leave the horse and the officer gets back up and back on. It's all crime, level 3.

## Text

Silkscreen for labels and buttons, Pixelify Sans for anything you read as a sentence (speech,
the ticker, the tannoy), bevelled pixel panels. Speech is comic bubbles drawn in the world,
and hits pop words: KO!, TAKEDOWN, +£35, UNSEATED!

## The diorama, and the naughty ways in

The west flank is now a walled **service alley** behind a palisade fence, with the railway
embankment's trees beyond: the kit room, the medical room and a back corridor sit behind the
West End. Ways into the dressing rooms, besides the ones already there:

- **The drain.** The pub cellar hatch (bolted: you need a wrench) drops into a Victorian sewer
  that comes up through the England dressing-room shower grate. Old Reg the groundsman, at his
  shed in the alley, tells you about it, and his wrench is lying next to the shed.
- **The scaffold.** On the corner of the ground by the car park: up, across the roof, down the
  ladder into the tunnel. Someone might see you.
- **The players' entrance.** A door off the alley that opens only to a swipe card. Wally the
  kit man has one: he drinks in the pub, walks round the alley, swipes in and sorts the kit,
  and goes round again. Pick his pocket, or knock him out and take it.
- **The stretcher.** Get knocked out inside the ground and you wake up in the medical room.

Also new on the approach: Dodgy Del the ticket tout (cheaper than the office; real tickets out of
his own pocket, and your money goes in it, so he's worth robbing), a TV reporter and cameraman,
the outside-broadcast truck, a horsebox, a pie stand and parked cars.

## More ways in, the Hitman way

Hitman's levels work because every way in is a person with a routine, a thing they carry, or a
place they leave something, and somebody nearby will tell you about it ("mission stories",
about half a dozen per level). Disguises are social: each outfit gets you somewhere, and a few
people see through it. We copied the grammar, not the content:

- **The stand roof and a parachute.** A maintenance ladder runs up the back of the South Stand.
  At the top: climb down, or jump. Para Steve is in the car park for the half-time display jump;
  his kit bag, with the chute in it, is on the floor by his van. With it you float down over the
  crowd onto the pitch (a crime, and the stewards come for you, but you're in). Without it you
  die, and it's the end of the day: "Fan dies in fall from stand roof".
- **Lenny the Lion.** The mascot smokes in the service alley before kick-off, then goes in
  through the players' entrance and out of the tunnel to wave along the touchline. Knock him out
  in the alley, take the costume: it covers your face, and a mascot belongs pitchside and in the
  tunnel. (A new PixelLab character: walk, wave, smoke.)
- **The press pass.** The TV reporter carries one. It gets you through a turnstile with no ticket
  and no pat-down.
- **The laundry hamper.** By the players' entrance. Get in, and when Wally the kit man next
  goes in he wheels it into the kit room with you inside.
- **Leads.** Talking to people turns up what they know: Old Reg about the drain, Wally about his
  card and the hamper, the cameraman about the scaffold, Steve about the ladder and his chute,
  the reporter about the pass, locals about Lenny, the beer lorry, the smoking steward and the
  stretcher, Del about his tickets. Each one pops up as "New lead" and is listed in the menu
  under "Ways in you've heard about". Nothing is forced: every route works whether or not you've
  heard of it.

Locals now each have their own bit of gossip (it used to be the same first line from all of
them), and staff go through theirs in turn without upsetting their routines.

## Mouth on him

The player shouts now, in one gravelly London voice (ElevenLabs stock voice, eleven_v3 with
accent and mood tags), with a speech bubble over his head:
- swinging: "Cunt!", "Fuckin' 'ave that!", "Fucking cunt!", "Suck on this!", "'Ave it!" and more
  (about every other punch, never more than one line every 1.4 s);
- knocking someone out: "Night night, cunt.", "Sparko! Fuckin' sparko!"; a takedown from
  behind is whispered: "Shhh. Sleep tight, sunshine.";
- robbing the unconscious: "Lovely jubbly."; on the horse: "Out the fuckin' way!";
- the parachute: "Geronimoooo!"; jumping without one: "Oh fuuuuuuck!"
People who hit back now have voiced lines too ("You cunt!", "Come on then, you fat cunt!"),
with a woman's take for women.

## Knock-ons

The other half of Hitman: what you do gets noticed, and the noticing opens a gap elsewhere.
- **Steve's chute gone:** he checks his bag, shouts, the tannoy cancels the half-time display,
  and he walks the approach looking for it, leaving his van.
- **Lenny missing** a minute before kick-off (knocked out, or his costume gone): the tannoy calls
  for him, and the corridor steward leaves his post outside the dressing rooms to go and find him,
  out through the players' entrance to the alley. Still missing after kick-off: "unwell".
- **Wally's card gone:** he finds out at the door, props it open ("back in a sec") for a minute
  and a half, and goes to the security office; the tannoy calls security to the players' entrance.
- **The press pass gone:** the reporter shouts for a copper, and PC Okafor leaves his post to take
  a statement.

## More to fight with

- **Improvised weapons:** empties on the pub tables and round the bins, chairs in the pub, pint
  glasses on the concourse bar, the four corner flags. A bottle, glass or chair counts as a
  weapon (three blows' worth) and goes to pieces on the first hit: "GLASSED!", "CHAIRED!".
  Holding one in plain view is alarming, like any weapon.
- **Haymaker:** hold the attack button (or E/space) and let go: the button burns yellow when
  it's ready. It hits as hard as a weapon, throws them further, and the camera shakes.
- **Counter:** someone you've hit who's going to hit back shows a flashing "!" for half a second
  before he swings. Hit him in that window ("Counter X!") and he's out cold.

## Inside the ground

Food kiosks, condiment stands and tellies on poles along the concourses, spilt beer and litter,
expansion joints and a yellow line on the concrete; urinals and basins in the gents. The dressing
rooms get shirts on pegs, the physio's table, an ice bath, a tactics board, boots and the showers
over the drain grate. Skylights and air-con units on the stand roofs, and the TV gantry along the
front of the main stand. Hampers are drawn as hampers.

## Facial recognition, disguises, and the final

- **Match two, if they know your face** (identified at the quarter-final): the tannoy tells the
  ground that facial recognition is on at every turnstile and stewards are looking for "a fat,
  bald man in his fifties". The cameras flag your face unless at least half of it is hidden.
- **Disguises stack.** Each extra piece adds a quarter to your best one, short of a full mask:
  a wig alone (0.3) won't do, a wig and a stick-on tache will (0.6), so will a floral dress and
  a long blonde wig (0.6). Second Hand Rose sells the wig (£9), the long blonde wig (£12) and the
  dress (£15). A wig is drawn on your bald head; a dress colours you pink down to the shins. Or
  cut someone's face off and wear it, which works, and looks insane.
- **The final** (match three, against Argentina at the National Stadium, built like the
  quarter-final ground) has everything: pat-downs, metal detectors, cameras, staff passes, and,
  "following recent incidents", a penis detector on a pedestal beside each turnstile. Show your
  ticket and the steward asks you to pop it in the slot:
  - **your own:** it's on file. "That's him! That's the fat bald fella! It's a match!" Arrested.
    ("Penis detector snares England fan at final")
  - **the censored bar** from the pub toilet: "Jesus Christ. Go on through, sir." You keep it.
  - **the dog**, held up to the slot: "Bit small. Bit hairy. Go on, then." The dog comes in too.
  The steward doesn't object to the dog at this ground; there's nothing left to object to.
- Win the final and England are world champions.

## The opening: Grozz

The player is **Grozz**. The first match of a session opens with a film (title card and a Play
button first, so phones allow the sound; Skip at any point; `?noopening` turns it off for tools):

- **Krunch News** on the telly, using KrelTV's news graphics ported from Krelworld (the ident with
  the globe and ribbon, the channel bug and clock, LIVE tag, headline strap, scrolling ticker, name
  straps), with PixelLab stills: the newsreader Penelope Gristle at her desk, England's new manager
  **Scronson Flabbergast** at a press conference ("The key is to score goals... The mentality we
  need is a footie mentality"), camera flashes, and a pub going wild.
- A pint glass comes from behind the camera and goes through the screen: cracks, static, black.
- **Grozz's front room** (PixelLab: a filthy little terrace, cans, pizza boxes, the battered
  sofa, the smashed telly sparking on its cabinet). Grozz rants about FIFA rigging it; his kids
  **Grozzy Jr** and **Screnton** fight over the iPad ("Me want iPad!"); he snaps it in half; his
  wife **Shezleigh** storms in; he takes her £40 benefit money ("which I deserve anyway, for
  being a good dad"); she screams about her nails; the kids fight over one packet of crisps; "Right.
  I've fucking had enough." The front door slams. KNOCKOUT DAY.
- All voiced with ElevenLabs stock voices (the newsreader, Scronson, Grozz in the same voice as
  his barks, Shezleigh); the kids are adult takes pitched up with ffmpeg. New PixelLab characters
  for Shezleigh and the two kids, with shouting, crying, punching and tug-of-war animations.
- The ground waits asleep underneath while it plays, so only one game draws at a time.

## Asset packs

The published game had grown past the artifact host's file limit (512 files a version). The
assets can't be hosted on GitHub instead: the artifact's security policy only lets the page load
pictures and sounds from its own files. So the build now packs every picture and sound into three
bundles (art, audio, the rest; about 17 MB in all) with an index. The game fetches them at
start-up behind a progress bar and answers its own requests from memory: Phaser's loader (XHR),
the sound loader (fetch) and the HTML icons (blob URLs). The published page is now six files, so
there's no limit to worry about. Loose files still exist for local development. The bundles are
named .pack.mp3 only because the host serves a fixed list of file types; they're raw bytes.

## Hosting: its own GitHub repo

The game lives on its own at https://krelworld.github.io/Glory-Quest/, deployed from the
Krelworld/Glory-Quest repo by its own Pages workflow, so it can never affect the Krelworld site
or the other games. That repo only holds the built game (`site/`: the page, the code, the asset
packs). To update it: `node build.mjs` in stadium/, then `tools/deploy-repo.sh <clone of
Glory-Quest>`; the push redeploys the site in about a minute. The match intro card now starts
hidden, so nothing stale shows while the packs download.

## Phone memory (the iPhone crash)

On an iPhone the hosted game crashed ("A problem repeatedly occurred") or came up with a black world. Measured in a phone-sized browser, the match was building 717 MB of pictures (540 MB of it recoloured canvases: every colour variant of every person got every animation sheet up front), with the opening film's game alive alongside it and about 130 MB of decoded sound. Now:
- Only standing, walking and cheering sheets load and recolour up front. Every other animation sheet is fetched and recoloured the first time someone does that thing, at most two a frame, under a 64 MB allowance; sheets unused for two seconds are dropped, oldest first. Grozz's own always get made.
- The film plays before the stadium is built, not alongside it.
- Sound runs at 24 kHz, and spoken lines (tannoy, stewards, voices, Grozz) decode the first time they're played.
- If the phone still takes the graphics away, a "Reload" prompt replaces the black screen.
The match now starts at about 134 MB of pictures and levels off around 230 MB.

## Tap a person; the walkie-talkie; the head stamp; out of the office

From play on an iPhone: the take-down "didn't work" on ordinary fans, he got locked in the security office after flattening the chief, and in a chase there's no time to open the bag and pick a weapon.
- **Tap a person** (anywhere: a quick tap on the stick side counts too) for a menu of everything you could do to them with what's on you: take down from behind, punch, haymaker, a line per weapon in your pockets (stab, glass, chair, hit with), throw, talk, pickpocket, money; and, if they're down, pockets, drag, stamp, radio it in, cut off face or hands. Pick one and Grozz walks over (round the back, for a takedown), gets the weapon out and does it. Moving the stick calls it off. (Taps also now account for the phone's pixel density: they were landing in the wrong place, so tap-to-aim was off too.)
- **Take-downs**: the main button's take-down was being turned into a punch when the button was held a moment (the hold-for-haymaker). A takedown is never a haymaker now, from behind is a choke whatever you meant, and one you went for still counts if he's half turned.
- **The office door** opens from inside unless you're being held there and the chief is up and about; anyone with a staff pass, or dressed as a steward or police, can come and go.
- **Walkie-talkies**: every steward carries one. Take it and, near a body: *"I've had to knock out a fan"* / *"I've had to kill a fan"*. Two stewards come from the back corridor, say they'll help cover it up, and take the body away; nobody raises the alarm, and the office door's held open. The clean-up crew never count as witnesses.
- **Stamp on a head**: out cold or dead, it bursts: blood every way, bits, a pool, a crunch, Grozz has a word. Once per head.
- **Memory, round two**: the source artwork stays as plain images and never goes to the graphics card, and outfits nobody has been drawn in for four seconds are let go and remade when they come back (60 MB allowance). After a tour of the whole map: 98 MB of pictures, down from 275.

## Shezleigh's voice, the row, the front room, and a mouth on him

- Shezleigh is now "Ruby B", an authentic Cockney London woman from the ElevenLabs voice library (library voices take no voice slot, so nothing was deleted), screeching, pitched up a semitone and made tinnier. She calls him a fat fucking cunt; he calls her a dopey fucking bint and a fucking slag.
- On his way out he smashes up the front room: the cans, the coffee table, the telly cabinet. Bits everywhere, crashes, the kids crying, Shezleigh ringing her mum. Then at the door: "You'll see... They'll all fucking SEE!"
- Grozz has 34 things to shout when he hits someone now (24 new, his own voice): "Take that, you cunt!", "Prick!", "Fuckin' 'ave it, you slag!", "Dopey cunt!", "That's for FIFA, you cunt!" and so on.

## Smarter stewards: heat, evasion, radar; a bike; the crisps and the telly

- **Who comes after you.** Only people who see a crime can start anything. A bystander's shout only brings stewards within earshot (close, and not through a wall), not every steward within 24 m as before. A steward who sees it himself radios for backup: the ones within about 40 m come to where it happened, and only chase if they then see you.
- **Heat** (MGS/GTA): 0 to 5 stars, with a label. *Noticed* when someone's watching you; *Alert* when they're after you and can see you (a sting plays); a star more if it's police or serious, five if the armed police have been called. Get out of their sight and it goes to *Evasion* with a countdown (10 s plus 3 s a level of seriousness), while they search where they last saw you. Seen again: back to Alert. Make it to zero and they give up ("Lost him."), your description fades, and there's 30 s of *Caution*.
- **Radar**, top right: walls and stewards within 26 m, each with a cone for where they're looking. Green: going about their business; yellow: onto you; red: coming for you; blue: police. It turns red on Alert and amber on Evasion.
- **Bikes**: two unlocked ones, one in the alley behind the ground and one up the east street (mirrored at the semi-final). Get on and you go at 9.5 m/s (11.5 flat out), much quicker than a sprinting steward. You come off if you're grabbed, knocked down or hide, or when you get off. You can't carry one.
- **The film**: the kids swear at each other over the crisps ("They're my fucking crisps, you cunt!") and start punching each other. Grozz rips the telly off the wall, screaming "I've fucking HAD IT!", and throws it across the room.

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

## Music, Shezleigh again, and the graphical overhaul

- **Music** (ElevenLabs music): matchday (gritty breakbeat with brass and a Britpop riff), chase (frantic drum and bass, alarm stabs), evasion (ticking, sparse), the Krunch News theme, the home cutscene (out-of-tune piano, wonky waltz), the title, win and lose. In the match the tune follows the heat: matchday, then chase on Alert, then the hiding music during Evasion. Decoded one or two at a time.
- **Shezleigh** was coming out Irish (the library voice plus my pitch-shifting). Now "Lizzie", a London Estuary/cockney character voice (EastEnders-inspired), with tags for a raspy forty-a-day smoker, and no pitch-shift. After "you fat fucking cunt" Grozz shoves her into the wall (crack, dust, she slides down) and she screams she's calling the Old Bill.
- **Research** (references in the report): 3/4 buildings with a distinct silhouette each; the door the brightest thing on the front, with a light pool; signs by picture as much as text; kerbs, markings and decals layered on the ground; prop clusters that tell a story; a muted world with saturated interactables; back walls shown when you're inside.
- **What was wrong**: every shop and the pub had its front on the south (ring road) side, and you arrive from the north, so you saw only blank grey roofs; nothing said what anything was.
- **Buildings**: each now one PixelLab picture (roof from above, front below), generated from a sketch of the old box so the footprint and door stay put, with the name painted on the board in our pixel font. The pub has a giant pint and England flags on the roof, the surplus shop a camo tarp held down by tyres, the bookies air-con and a neon horse, the hotel plant rooms; so they read from the stadium side too. The charity shop's doorway moved 1.6 m to match its painted door. Pub and hotel are drawn at half size and doubled (too big for one image at full size).
- **Stadium front**: built from three painted bays (cladding with a shutter and fire exit; a glazed stair tower; the crest bay with St George banners over the turnstiles).
- **Inside**: each enterable building shows a painted back wall (pub back-bar, charity shelves, surplus pegboard, bookies' screens, hotel reception).
- **Street**: kerbs with a lit edge and a drop, double yellows, three zebra crossings with Belisha beacons, drains, gum, fag ends and cracks (thickest by the pub and turnstiles), a shadow along every frontage, a warm light pool at every public way in (purple at the bookies), and new props: kegs, smokers' bins, bus shelter, newsboards, flagpoles, grit bin, pigeons, doormats, manholes, chip papers, dropped scarves.
- The OB truck, which had ended up inside the bookies, and a car parked across its door are now in the car park.

## The person menu: a ring, not a list

The tap-a-person menu was a full-screen list, several of its lines near enough the same thing (punch, haymaker, takedown). Phone games with lots of actions on one character mostly do one of two things: a ring of icon bubbles round the character, so the world stays visible (Sims Mobile and FreePlay), or one button that does the sensible thing with the variations behind a hold (GTA's weapon wheel, Don't Starve on phone). Hitman Sniper and GO offer one contextual action at a time.

So: tap someone and a ring of icon buttons opens round them, following them as they move. Attack (big, red, at the bottom nearest your thumb) does the sensible blow: what's in your hand; a choke if he's turned away; else a punch. Hold it and the ring turns into the variations: punch, haymaker, choke, and a button for every weapon on you (glass, stab, chair, hit with). Then Talk, Pickpocket, Bribe, and Throw if you're holding something. Someone down gets Stamp, Search, Drag, Radio, and Face and Hands if you've a blade. Tap anywhere else to put it away. New PixelLab icons for each action.

## Feedback round: detention, the ring, women, gore, combat, cars, Scronson

- **Detention / frogmarch**: caught, a moment to struggle, then a fade to black; the move to the office (or the gate) happens in the dark and the camera's already there when it lifts (it used to cut mid-fade, so the camera visibly slid across the map). Stewards draw each line from a pool (caught, struggle, sat down, barred, spotted), never the same one twice running, in two voices; and only one person's voice plays at a time (the bubbles still show), so they no longer talk over each other.
- **The ring now has everything** you could do to that person: set the dog on him, show a ticket, give or plant something, flash the vest, buy, bet, tip off, arrest, leer. Worked out as if you were stood next to them; pick one and he walks over and does it when he can.
- **Horse**: gallop 16 m/s (was 10), trot 7, quicker to get going, galloping from a lighter push on the stick.
- **Screams** only when someone sees something terrible (a witnessed crime of severity 3+), or finds a body. Not on every kill.
- **Hi-vis**: a vest gets you the concourses, the stands and the staff corridors, and the turnstile stewards wave a colleague through ("Flash the vest"). It doesn't get you the dressing rooms, the officials' room, the tunnel, the kit room or the security office, nor the pitch. Get seen doing something in it and it's blown for four minutes: they know you're not one of theirs.
- **Doors**: push against one you can't get through and it tells you ways you might (turnstiles, staff door, players' entrance, the office, the service gate), once every 25 seconds a door.
- **Women**: about a quarter of fans are women, with women's names, the woman's body and voice; locals called Sue and Lisa are women. (Before, body and name were picked separately, so a "Nige" could be drawn as a woman.) "Leer" at a woman: Grozz says something filthy (six lines), she tells him where to go, slaps him, or her fella comes over to sort him out. Stewards count it, a little.
- **Head stamps**: a 12-frame PixelLab burst (blood, brain, skull, an eyeball) where the head was, and the body stays headless in a pool of it (PixelLab refused to draw the stump, so the gore over the head is painted on afterwards).
- **Combat** (looked at Arkham's freeflow, Sleeping Dogs, Assassin's Creed): the problem was that a blow knocks them out of reach, so the hit button vanished or jumped to someone else. Now a strike lunges you up to 3.2 m onto your man; the hit button sticks to whoever you're fighting for five seconds (and becomes Stamp once he's down); a tap while you're still recovering from a blow is kept and goes off as soon as you can.
- **Cars**: kick any car (parked ones go off: alarm, flashing lights, stewards look over). Stand in the road till one stops, then drag the driver out (or the copper, out of a police car) and drive it: steer with the stick, push harder to go faster, pull back to brake. Walls crunch, people go under the wheels, the driver comes after you. Get out and leave it; get back in later.
- **Scronson Flabbergast**: a new face: fat, greasy comb-over, double chin, food down his tracksuit, gormless. A new voice ("Pip Bumblebottom", a dopey village-idiot from the ElevenLabs library) with pauses and "erm"s.

## Tactics without turning it into a strategy game

From research (Desperados III, Shadow Tactics, Door Kickers, Hitman, MGSV, Splinter Cell Conviction, Mark of the Ninja, Hotline Miami, Superhot, Invisible Inc., Untitled Goose Game): the ones that stay kinetic make planning optional, short and one step deep (Mimimi deliberately capped Showdown at one queued action because more "would nearly change the genre"), turn being seen into a beat you can recover from (MGSV's reflex), and let you read the guards' minds (three clear states, a last-known-position ghost) instead of tracking hidden numbers. Door Kickers-style multi-step queues are clumsy on touch. So:
- **The Gaffer's Eye**: while the tap-a-person ring is open the world runs at a fifth of the speed, on a meter (five seconds of it, refilling over fourteen) shown under the name, so you can't live in it.
- **One order queued, never more**: if he's already walking over to do something, what you pick next goes after it ("Then: ..."). Move the stick and both are called off.
- **"Oi! YOU!"**: when a steward first sees you do something, a beat of slow motion (1.3 s, shorter each time, not more than once every nine seconds), the hit button locks onto him, and he takes a second and a half to get his radio out: flatten him first and no backup comes ("NO BACKUP").
- **Last known position**: during Evasion a pale ghost of you stands where they last saw you, and that's where they go and look, so you can double back. Searching stewards show a "?".
- The main button never offers the same blow as the hit button (it doubled up "Take down Shaz").
- The page now asks for game.js and the asset packs by a version stamp, so a phone can't mix a new game with old cached art (a screenshot showed the old buildings).

- **To do**: an Untitled Goose Game-style list in the menu (get in, flatten a steward, ride the horse, nick a car, get on the pitch, set a dog on someone, stamp on a head, get slapped, nick the bus, parachute in, wear Lenny, lose a chase). It names the mischief, never how; each one ticks off with a strap and a chime when you do it.

Not done yet, from the same research: a quicker retry from the checkpoint after an arrest.

## Feedback round: the phone, grasses, talk, the look, starkers, hidden stories

Researched first (GTA IV's phonebook, Watch Dogs 2's police hoax, Hitman 3's burner; Hitman and RDR2 witnesses; Valve's response rules and Animal Crossing's per-villager memory; Stardew mobile's tap-to-move; Hitman's disguise HUD; Saints Row streaking; Parc OL and FIFA stadium wayfinding; Ace Attorney and Persona dialogue controls). Full comparison with Hitman in `docs/review-hitman.md`.

- **Talking** is an exchange, not one line: mostly comedy (tribal, conspiratorial, thick), sometimes a tip that writes a lead down, a gift, a scam (a tenner borrowed "till half-time"), a phone number, or aggro. No NPC says anything to you twice; nobody in the ground repeats a line said in the last seventy; ask too often and they shrug. Fans chatting in groups answer each other. Before, every fan had the same six lines and a given fan always said the same one.
- **Bubbles**: nearest six only, never stacked on top of each other (pushed up with a longer tail), kept on screen; yours are pale blue.
- **Grasses**: a fan who sees you do something with no steward in earshot says so and sets off to find one: an eye over his head with a ring running down. Pay him off (cheap), lean on him (better with a weapon in your hand), or flatten him. A home fan watching you hit an away fan might just cheer. If he gets there, the steward knows where you are.
- **Bribe** only appears where money means something: a grass ("Pay off"), a fan with a spare ticket ("Buy ticket"), stewards, their players, the referee.
- **The ring** works when your thumb's resting on the stick: it takes a proper push to call off a walk-over.
- **Tap the ground to walk there** (a ring marks the spot, red if there's no way through). The tap that closes the ring doesn't walk you anywhere.
- **The phone** (new button): choose the handset at the top, your own phone (in your name: hoaxes get traced, and every copper knows where you're stood for forty seconds) or a burner (found behind the pub bins, or from the dealer; a hoax snaps its SIM). 999 to tip the police off about anyone (plant something on a player first; a steward you report gets taken aside to the van and his post's empty), or a bomb threat (holds kick-off, or stops the match till they've swept the ground). Shezleigh: she says hello, Grozz says something unforgivable, she starts, he hangs up mid-sentence (voiced, five insults, four replies). Numbers people give you: Spliff Ricky comes to you (powder, laxative, burners); Bare-Knuckle Brendan flattens whoever you point at for £50, and the stewards go after him.
- **The walkie** works from the bag: call in a body near you, or "Trouble, all units": every steward within 40 m goes to the far side of the ground (once every 75 seconds; the third time they rumble you). The clean-up crew are drawn as stewards.
- **The look**: change clothes and a card shows Grozz big, as he looks now, with what the outfit opens, who sees through it, and how much he stands out (Hitman's disguise status).
- **Starkers**: strip from the bag. Clothes in a heap, pink to the ankles, a very small black bar. Onlookers shout (voiced: "He's got his willy out!", "He's a pervert!", "Is that it?!"), film it, and every steward who sees will have you for indecent exposure. On the pitch during play the match stops till you're off or caught.
- **Hidden stories** (never signposted): Lonely Len's spare ticket for a lovely lady (a dress and a wig); a stag do who think you're Robbo (a dress); Mad Mick's fifty quid for decking the ref; off-duty Dave's warrant card (pickpocket it: a turnstile waves you through); a kind stranger with a top for the naked man.
- **Inside the ground**: every gangway into the stands now has floodlight spilling out of it, a painted block panel (S1, S2, S3, W, E) with arrows, and an aisle of steps up through the seats; a programme seller, bins and litter on the concourse.
- **To do** grows: streak, bomb threat, shut a grass up, have someone sorted out, find a hidden story.
- **Opening film**: tap anywhere (or Next) to cut a line short; Skip film skips it all; lines play 7% quicker with shorter gaps.

## Feedback round: alerts, stars by crime, roofs, bricks, windows, stink bombs, the rifle, the drag voice

Researched first: the MGS alert/evasion/caution chain and its "!" sting, MGSV's reflex, Splinter Cell's layered stress music; GTA III–V, RDR2, Bully and Watch Dogs on wanted levels and witnesses; Assassin's Creed, Dishonored and Hitman on rooftops, perches and being identified at a distance; Hitman, The Last of Us and Untitled Goose Game on thrown objects; Hitman's sniper rifle and emetic gas; Bully's stink bombs.

- **Spotted**: a sharp "!" sting (once per change of state, never stacked) and the "!" over the steward who saw you. Alert now plays a new driving, stressful track (taiko, low strings, brass stabs, louder than the matchday music and straight in); out of sight it's the tense hiding music; Caution has its own uneasy track; then back to matchday.
- **Stars match what they saw you do** (GTA's rule): a pickpocket or a leer is one star however hard they chase; a punch is two; something serious (a weapon, a player, the referee) is three; a killing is four; armed police five. The police joining in, or a spree (four crimes seen inside two minutes), adds one, never past four. Before, any chase was three stars and the police made it four.
- **Roofs**: ladders up the fronts of the pub, the charity shop, the army surplus and the team hotel (and the old one on the South Stand). Up there you walk about freely, you throw 40% further, and people rarely look up: you're seen from nearer, and unless someone's within about nine metres all they saw was a fat bloke on a roof, so the description has no face and fades sooner. Balance: ladders are the only way up; stewards wait at the bottom ("Come down from there, you idiot!"), then come up after you; dropping off any edge is the quick way down and leaves you on the floor for a moment (the stand's five metres hurts). Drop off the inner edge of the South Stand roof and you're in the concourse: a way into the ground.
- **Bricks** in piles by the scaffold, the alley, the car park and the pub yard. Every thrown thing now has its own range (a brick 13 m, a pint 14, a canister 17); a brick to the head knocks a man out.
- **Windows**: two in the outer wall of the South concourse. A brick through one (thrown, or by hand with anything heavy), then climb through. Loud: stewards nearby come to look.
- **Fart canisters** (in the alley by the skip, or £15 from the surplus shop or the dealer): thrown, a green stench seven metres across for twenty seconds. Everyone in it gags and gets out, stewards off their posts included; on the pitch it stops play. You can still see through it (unlike a flare).
- **The sniper rifle**: lying on the team hotel's roof from the semi-final on. "Look through the scope" goes into first person, zoomed, drawing out to 85 m, from the roof's height. It sways; hold your breath to steady it for three seconds (then it shakes worse). Three rounds. Every shot kills if it hits (likelier the closer), everyone within 60 m panics, it's the worst crime there is, and the armed police are called after the first.
- **Grozz in a dress or a wig** shouts all his lines in his own voice straining at a lady's falsetto (re-recorded with the same voice and a falsetto direction, then nudged up two semitones with the formants kept, so it's still him).
- **To do** grows: get up on a roof, put a brick through a window, clear a crowd with a stink bomb, take a shot from a long way off.

## Interiors as rooms; film controls

Looked at how top-down games handle going indoors: most (Zelda, Pokémon, Stardew Valley) keep interiors as separate maps behind a door with a fade; roof cut-aways (fading the roof on entry) work for single-room buildings but leave the street hanging round the room, which is what felt odd here: the front simply vanished and the shopkeeper you'd seen outside was suddenly in a different picture. The world here has to stay one place (people come and go through the doors, stewards chase you in), so it's a hybrid: through the door is a quick dip to black, the camera already framing the room when it lifts (zoomed in as far as the room still fits); everything outside the room's walls is blacked out, the street's props and people aren't drawn, and the building's front only changes while the screen is black. Coming out is the same in reverse.

The opening film now has Krelworld's control bar along the bottom: Pause, Next (cuts the line short, or the pause between beats) and Skip. The start card now says you can tap the ground to walk and tap anyone for the ring.

## Fixes (mission stories), Scronson's voice, pausing, walking speed, back-of-house art

**Fixes.** Hitman's mission stories, kept systemic so they don't crowd out the sandbox:
- **Three per match, about the result:** their star, their keeper, the referee. Each is a lever the football simulation already responds to (the measured win rates near the top of this file).
- **Never handed to you.** You find each one by overhearing it: fans' gossip, the barman, a cleaner, Mad Mick. Each new thing you hear adds a way of doing it to the menu's Fixes page. No waypoints and no markers, so you still have to go and find them ("Nobody will tell you how").
- **Judged by outcome, not steps.** The game checks whether their number 10 is off the pitch, whether their keeper's been got at, whether the referee's been bent, drugged, decked or replaced. Any method counts, including ones nobody told you about ("Fixed, your way").
- **They produce chaos rather than replace it.** Every listed way is an existing system: framing and tip-offs, the dosed cooler, the bus, the roof, bribery, the tea urn, the ref's kit, Mad Mick. Each has its own witnesses, heat and knock-on effects.
- The evening news reports what happened to the star, the keeper and the referee.

**Other changes.**
- **Scronson** is re-recorded with a Yorkshire voice from the ElevenLabs library, slow and gormless, with Yorkshire contractions in his lines.
- **Pausing:** the world now pauses while the bag, the look card or the phone is open, and carries on at the same speed when you close them.
- **Walking speed:** walking goes from 4.4 to 5.2 m/s and running from 6.4 to 7.3 m/s.
- **Back-of-house art:**
  - painted back walls for the security office (a CCTV bank, the stadium plan, mugshots, lockers), the kitchen, the medical room, the kit room, the officials' room and the stewards' cabin;
  - proper door pictures: a steel staff door that stands open, lit, when it's open, and the players' double doors under the three lions.
- **Pseudo-3D buildings: not doing it.** The view is already the three-quarter oblique view that top-down pixel games use (fronts with height, roofs, things behind walls hidden). The flat look came from the bits left as plain blocks, not from the projection. A perspective or parallax pass would fight the 1:1 pixel art (sheared pixels, shimmering edges) and phone performance, for less gain than painting the rooms and doors properly. The optional first-person view stays for the moments that want it (the scope).

## UI review: less on screen, and only what matters

A screenshot of the pub showed six speech bubbles, three rows of HUD (the speed buttons sitting on the objective), five empty stars, and seven buttons. What other games do, and what changed:

- **Speech.** GTA, Hitman and RDR2 subtitle only what's aimed at you or matters, and leave crowd chatter as sound. The Sims and Animal Crossing show background talk as a little "…". Now:
  - Full bubbles go to whoever you're talking to (for 12 seconds after Talk, Lean on or Bribe), to stewards and police who are after you, to grasses, and to anything useful (a fix or a way in). Useful lines are tinted yellow so you know to read them.
  - Of the background chatter, only the nearest one line at a time shows, smaller.
  - Everyone else talking gets a chat dot.
  - Bubbles keep clear of the radar.
- **Top of the screen.**
  - GTA V shows stars only while you're wanted, so stars and the heat label now appear only then.
  - MGS and Hitman flash the area or objective and then clear it, so the strap now shows the area name, or the objective for five seconds when it changes, then hides. A "you shouldn't be here" warning stays.
  - The 1P and zoom buttons moved into the menu (in first person the 1P button comes back as the way out).
  - Fast-forward appears only while you're sat watching the match, bottom left.
- **Buttons.** Mobile action games keep one big contextual button with two or three secondaries under the thumb, and the rest behind a menu. Now:
  - The big red button does the obvious thing.
  - Under it are the blow and the throw, with short labels ("Punch Kev", "Throw at Kev").
  - More, Phone and Bag are small utility buttons along the bottom.
  - The Bet button is gone: bet with the phone's betting app or at the bookies.

## Side-on rooms: only where a side view is the better game

**Verdict: side-on only for short linear passages.**
- **Ordinary rooms: no.** Every room is a walkable space other people path through (stewards come in after you, fans queue at the bar), so it has to obey the same two-axis movement and map as everywhere else. Showing one room from the side would mean:
  - squashing its depth into a strip;
  - turning the joystick's up and down into nothing;
  - making the radar and the doors disagree with what's on screen.
- **Short linear passages: yes.** That's where games that mix the two do it well: Link's Awakening drops into side view for underground passages, and the cubicle close-up already works here.
- **First case: the pub-cellar drain to the England dressing room.**
  - It's now a side-on crawl through a Victorian brick sewer (hold Crawl).
  - Rats come at you: tap one to boot it, or it bites and you stop.
  - A long-dead fan in an '86 shirt is slumped against the wall with his wallet (£20, once).
  - A ladder goes up through the shower grate.
  - The world waits while you're down there. The simulation still moves you in one step, so routes, timings and tests are unchanged; the crawl is the view's.
- **Other candidates if this lands:**
  - the scaffold-and-roof run to the tunnel;
  - the laundry hamper ride into the kit room;
  - the inside of the beer lorry.

**Detention, side on.** Being held in the security office is now a side-on scene: you're on a plastic chair, the head of security is by his desk under the CCTV, the door is behind him, and a clock runs down to the police (or to being thrown out).
- **The choices:**
  - **Bribe him:** up to £60, and he might take it.
  - **Talk:** one sob story per detention; a 30% chance he lets you go if the police haven't been called, and a put-down otherwise.
  - **Get up:** back to the office top down, to try it the hard way (the door, the walkie, or him).
- **The office itself stays top down,** because people walk in and out of it and you can break into it. The scene is only for the moment you're sat still facing one man. The world carries on underneath, so the clock is real.

## Shops: served across the counter, fuller floors, a bell on the door

**Shopkeepers lead with Buy.** Tap a shopkeeper and the big button is Buy (Bet at the bookie's), with Attack beside it. Talk is gone for them.
- **What they'd have told you, they tell you over the counter.** Opening the shop has them say their next line, which shows at the top of the shop window as well as over their head.
  - It counts as overheard, so a lead or a fix registers as before.
  - A line that points at something is edged in yellow.
- **The gossip is now worth hearing:**
  - Rose: chef's whites get you into any kitchen.
  - Sarge: the stand roof and a brick; the stink cans clear a stand.
  - Lionel: their keeper likes a bet (the keeper-bribe fix).
  - The landlord already had the keeper's bet.
- **Why:** Talk to a shopkeeper was a second button for the same visit. Most games fold it into the shop screen (Stardew's shopkeepers greet you in the shop window; RPG merchants say their piece as the menu opens).

**Served from the customer's side.** The counters moved to the back of each shop, with the shopkeeper behind and the shop floor in front.
- Tapping Buy walks you to the front of the counter, not round behind it.
- The shop opens from up to 3.6 m away.

**Fuller interiors.** New PixelLab props:
- **Charity shop:** a counter with a till, bookcases, a mannequin in a frock, a table of tat, rails.
- **Army surplus:** an ammo-crate counter with a glass top, camo on a rail, ammo tins, a dummy in a gas mask.
- **Bookie's:** two counters behind glass with stools, slip stands, fixed-odds machines.
- **Team hotel lobby:** a reception desk, sofas, palms, luggage trolleys.

**Walking in.** As the door goes, each building plays its own sound and shows a name card in the colours of its sign, for a couple of seconds (a location card, as in Yakuza or Hitman).
- **Sounds** (synthesised):
  - the shop bell on its spring;
  - the bookie's electronic chime;
  - the bell on the hotel desk;
  - the pub's noise.
- **Shop prices** are now red BUY £n buttons; what you can't afford reads NEED £n.

## Round: voices, solid vehicles, ladders, doorways, the look, turnstiles, money, the pub

**Voices match the opening.** Grozz and Shezleigh now sound the same in the game and on the phone as in the opening.
- **Why they didn't:** the opening uses ElevenLabs' newer model with Grozz's voice and Ruby B for Shezleigh. Half of Grozz's fight barks and every phone line had been made on the older model, with Lizzie as Shezleigh.
- **What was re-recorded:** 29 barks and 15 phone lines, on the newer model with the opening's voices and the opening's screech treatment for her.
- **Volume:** voices play about 25% louder than effects.

**Vehicles are solid to walk into.** This covers:
- the lorry and the coach while they're stood or crawling;
- the traffic;
- your car when you're out of it;
- the police van and the burger van.

A vehicle moving quickly still knocks you down rather than blocking you. Only the player bumps into vehicles. NPC routes are planned round walls, and a crowd jammed behind a parked lorry would look worse than the odd fan stepping through one.

**Ladders reach the roofline.** Each building has its own ladder length, measured off its painted front: pub, shops, hotel, stand.

**Walking into a building.** Under a second, played over the cut to the room, then the name card:
- the shop's own front door in its own colours with its name over it;
- Grozz from behind, waddling up;
- the door swings open, the light spills out, and in he goes.

It plays when you go in, not when you leave, and once per building per 20 seconds, so nipping in and out isn't a chore.

**The look:**
- **Two new PixelLab characters**, with every animation the shirtless sprite has:
  - Grozz in a floral frock (hairy calves, trainers);
  - Grozz naked with a smooth doll's crotch.
- **Censor:** the naked one gets the telly's mosaic, a shimmering block of skin tones, not a black bar. There's no mosaic from behind.
- **Moustache and wig** are painted into every frame of his sprite, found from the head in each frame, so they sit on him whichever way he faces. From behind you see the wig, not the moustache.
- **The dressing room:** Grozz big and slowly turning, with every wearable you carry as a tile underneath. Tap to try on or take off. The panel stays open.
- **Swapped clothes** go in your pockets when there's room, not on the floor.

**Disguises work after you've been seen (Hitman's rule).**
- **Out of sight:** change clothes where nobody chasing you can see, and they lose you.
- **In sight:** change in front of them, and the new outfit goes round on the radio.
- **The turnstile bug:** while the stewards were on alert, the turnstile steward silently ignored your ticket. Now:
  - if he's after you: "Don't you move";
  - if he's busy with someone else: "Wait there";
  - otherwise he serves you, but stops anyone who matches the description going round.

**Turnstiles:**
- New booth art: an open blue steel frame, a ticket reader with red and green lights, flaps that fold back while the gate's open for someone. The old art was a closed glass door misspelt "TURNILE".
- Yellow queue lanes and chevrons are painted up to each turnstile.
- **Showing your ticket:** the ticket slides into the reader with a beep and a green lamp, then the flaps clunk back. If it's rejected, you get a buzz and a red lamp.

**Money: betting is gone; the to-do list pays.** Each item pays once, through the sim so it saves and replays.
- **Pay rates** run from £5 (getting slapped) to £40 (nicking the team bus).
- **Balance:** you start with £40 and a ticket costs £45–60, so two or three easy jobs get you in. The keeper bribe (£100) or a bent referee (£150) takes a proper afternoon.
- **Removed:** the betting app and the kiosk's bets. The betting code stays underneath for tests.

**Lucky Lionel's is now Cash Kings Pawnbrokers.**
- **The loop:** rob, sell, spend. Betting was a sum on a menu; this gives every wallet, pass, phone and stolen shirt a price.
- **What he sells:** a walkie, a burner, a bike, sunglasses.
- **What he buys:** almost anything, for about a third of what it's worth (stolen gear more). He won't touch a face or a pair of hands.
- **The shop itself:** jewellery counter, tellies, guitars, bikes, and a new back wall and window displays.
- **Keeper hint:** Lionel still tips you off that their keeper "likes a bet".

**The pub, calmer and with more to do.**
- **Fewer people, settled in place:** at most 11 drinkers; when it's full, people go to the yard instead. They settle in groups at the bar, the tables, the telly and the pool table, and stay longer, instead of wandering the whole floor.
- **Floor:** floorboards instead of the loud patterned carpet.
- **Toilets:** a TOILETS sign with an arrow at the door.
- **New things to do:**
  - **The fruit machine:** £1 a go, roughly 80p back in the pound. Three lions pays £20.
  - **A pool cue:** left on the table; it snaps over someone's head.
- **The toilet cubicle scene** has a new pixel-art backdrop: a graffitied green partition, a strip light, a puddle.

## Round: Ronson, the coach, the swoop, codec calls

**Ronson is Grozz's dog.** He's a PixelLab pit bull (brindle, studded collar, tongue out) with walk, run, lunge and chew animations. The same sprite is used in the films and in the game, replacing the old hand-drawn dog.
- **In the house:**
  - he's eating the settee from the start, with stuffing everywhere;
  - when the crisps burst he goes for the kids, growling and lunging;
  - "SHUT IT, RONSON!" / "He's just telling them he loves them in dog language!";
  - on the way out: "Get 'ere, Ronson, you cunt!" and he follows Grozz through the door.
- **At the ground:** Kev has tied him up outside the Three Lions. Untying him is no crime, because he's yours. A reminder appears when the match starts.

**The coach.** After the title, Grozz sits in the front seat of the supporters' coach next to Kev, a fat cockney he's never met.
- **The art:** a new detailed coach interior with the lads singing behind; Grozz and Kev drawn bigger and finer than the room sprites; Ronson on the seat across the aisle, chewing it.
- **The farts:** both of them fart relentlessly (green clouds, "Smell that!"). They swig cans, the coach sways, street lights sweep past.
- **What Kev tells him, without it sounding like a tutorial:**
  - the three things that could stop England: their number 10, their keeper ("likes a flutter"), the ref;
  - keep your ears open, people talk, and how you do it is up to you;
  - you can do all sorts: change your clothes, get on a roof, use the phone, a brick, a bung;
  - forty quid won't get a ticket (the office wants sixty, Del does them cheaper);
  - the lads have a whip-round for every daft thing you pull off (the paid to-do list);
  - the pawn shop pays cash, no questions.
- **The dog banter:** dogs are banned ("He's me therapy dog. For me autism."); he could do with a walk ("Can't be fucking bothered… it's me fibromyalgia."); Kev offers to walk him and tie him outside the Three Lions.
- **Kev's voice** is "Eastend Steve" (a library cockney voice) on the newer model. Grozz is on his own voice.
- **The music** from leaving the house carries on quietly under the chanting.

**The match opens with a swoop.**
- **How it's made:** the whole ground is photographed from above in tiles from the live game and laid on a 3D plane in the browser (CSS perspective).
- **The flight:** the camera starts high and tilted like a model with the venue and fixture over it, swings round the pitch, then comes down the approach onto Grozz.
- **The hand-off:** it lands at the game camera's own zoom and position, so the cut doesn't show.
- **Skipping:** tap anywhere.
- **Why not Krelworld's flyover code:** it's built on Phaser 3 Meshes, which Phaser 4 dropped. The idea is the same: a photo of the map as the ground, flown through with a perspective camera.

**Phone calls are codec style (Metal Gear's radio).**
- **The screen:** Grozz's face on the left, theirs on the right (Shezleigh, the 999 operator, Spliff Ricky, Bare-Knuckle Brendan), a green frequency and signal bars between, scanlines, and the words underneath.
- **Who's talking:** that face lights up and jitters while the other dims. When the call ends, both go dark.

**Intro polish:**
- **The moonwalk:** anyone walking sideways used to walk backwards, because east and west were swapped in the direction sum. Fixed.
- **The iPad and crisps** are proper pixel art. The iPad snaps into two real halves with a spray of glass. The crisp packet tears in two and the crisps rain down and bounce.
- **The rampage:** Grozz now breaks the room for real. The armchair, the telly cabinet, the cans and a crate are cut out of the painted room and fly apart in chunks that land as rubble, with bare floor where they stood.

## Round: bald Grozz, HD Grozz, XL bully Ronson, the frock's admirers

**Grozz is bald and late 40s.**
- **In game:** his sprite (in every outfit and every animation) has the crown painted out to skin with a shine on top, so his buzzcut hairline is gone. It's done in the same per-frame pass as the wig and moustache, so other fans built on the same sprite keep their hair.
- **In the films:** a new high-detail Grozz, a 128 px PixelLab character drawn twice as fine as the game sprites: bald, grey stubble, jowls, red nose, tattoos. He has walk, idle, punch, rage, throw and snap, and plays him in the house.
- **The coach and phone:** the coach-seat art and the codec portrait were redrawn to match (bald, grey stubble, late 40s).

**The wig** is drawn as hair now: strands down from a parting, darker at the edges and underneath, a sheen across the top, and ragged ends on the long one. It replaces the tiled checker pattern.

**Ronson is an XL bully:** massive chest, a brick of a head, blue-grey with a white bib, studded collar. Same animations as before, everywhere he appears.

**In a frock, men take an interest.**
- **Leering:** every so often a bloke nearby who can see you leers ("Big girl, aren't ya?", "Give us a twirl, sweetheart").
- **Advancing:** about half of them come over and get handsy ("What's under that dress then?"). Grozz shrieks in his falsetto.
- **Self-defence:** flatten the man who has his hands on you and it isn't a crime. A woman nearby shouts "Good on ya, love!", or a steward says "Fair enough, he had that coming", and a steward who was after you for it lets it go.
- **Not a licence:**
  - Throw the first punch at a man who's only looked at you, and it's assault.
  - A knife in him isn't self-defence either.
- **Giving up:** walk away and he gives up ("Frigid cow!").
- **To-do item:** it's on the list now, "Flatten a bloke who gets handsy" (£15).

**Detained in a frock:** the head of security is patronising instead of bored ("Shouldn't you be at home, love? Who's doing the tea?", "Football's a man's game, darling"). His replies to your sob story change to match, including when he lets you go: "Off you pop. And leave the football to the men, eh?"

## Round: guidance, the notepad, Instinct, touch beats, calls, unlocks, the front page

The research pass (Hitman's guidance, the Goose's to-do list, Chinatown Wars' touch design, Apple and Android control guidelines) turned into these, all optional and none of them a tutorial.

**Track a lead (Hitman's tracked mission stories).**
- **Choosing:** in the pause menu, every fix and every way of doing it you've heard about, and every way into the ground, has a Track button. One at a time; tap again to stop.
- **On screen:**
  - a gold line under the objective with the lead's name, its distance and what to do;
  - a gold star over the place, person or thing it needs;
  - when that's off screen, the star sits at the edge pointing the way.
- **Finishing:** it ticks itself off when the fix is done, or when you're in the ground for a way in.

**The notepad (the Goose's to-do list, kept to hand).**
- **The list:** a little paper note under the objective with the two nearest jobs and what they pay. "Nearest" is worked out from where each job happens: the ladders, the bus park, the horse, the bricks.
- **Tapping it** opens the full list.
- **Feats unlock kit to bring next time** (Hitman's mastery). Examples: the streak unlocks the long wig, a roof the brick, a stink bomb a fart can, flattening a steward the hi-vis, getting handsy blokes off you the dress.
  - They're saved in the browser and appear in the stash at the next match day's kit screen.

**Instinct (hold the button, or I).**
- **The view:** the world dims and every steward's and copper's eyeline is drawn on the ground (red if they're after you).
- **Highlights:**
  - useful things on the floor glow yellow (bricks, cans, passes, the cooler, the urn);
  - ladders, hatches and the scaffold glow green;
  - their number 10, their keeper and the ref are ringed red and named;
  - the people with a hook (Del, Wally, Mad Mick, the reporter) are blue, and Ronson's marked.
- **Searching:** while they're searching for you, the radar shows the zone they're combing as a pulsing dashed ring (GTA's search area). Get outside it.
- **Shedding heat:** flatten one of the stewards who's hunting you and the search gets four seconds shorter (Chinatown Wars: take out your pursuers to lose the heat).

**Touch beats for the fiddly jobs (Chinatown Wars' under-ten-second mini-games).**
- **The four:**
  - **Pickpocketing:** tap in the green. Win and it's a clean dip that nearly always works; fumble and he catches your hand in his pocket.
  - **Hotwiring:** two taps. Fail and the alarm goes off.
  - **The cellar bolt:** jimmy it.
  - **Spiking a drink:** hold to pour, let go in the band. Fail and it's down your front.
- **Rules:**
  - The world waits while you do one.
  - Skip does the job at the normal odds.
  - They can be switched off in the menu.

**Touch polish:**
- **Throwing:** whatever you're holding shows a dotted arc to its target, higher the further it goes.
- **Framing:** on a phone held upright, Grozz is framed a little above centre, clear of the buttons.
- **Vibration** on hits (yours and theirs), knockouts, purchases and payouts. Android only, because iPhone browsers don't support it. It can be switched off.
- **Left-handed layout:** a menu option puts the buttons on the left.
- **Holding the big button** (on anything but a punch) opens the list of everything else you could do there.

**Incoming calls (codec).**
- **Shezleigh** rings once you've done something big in front of a crowd ("You're on the fucking telly!"). If you're in a frock: "Why are you on the news in a fucking DRESS?!"
- **Kev** rings at half-time with a whisper about whichever fix you haven't heard of yet (the keeper, then the ref, then their number 10). Answering it counts as overhearing it. If you've heard them all, he's just seen you on the big screen.
- **Ricky** rings a couple of minutes in with his number.
- **Answering:** you answer or ignore. Ignored calls ring off.

**The front page.** At full time, a Krunch News front page:
- your headline;
- a photo of the moment it ended;
- fixes sorted, things done, cash earned, incidents;
- a Grozz rating out of five.

Share it from your phone's share menu, or save it as a picture.

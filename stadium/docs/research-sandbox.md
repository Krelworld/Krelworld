# Knockout Day: research for the sandbox redesign

Scope: density and diorama layout, access and scheming, easy combat (knockouts, bodies, looting, dragging), the police horse, an optional first-person view, and pixel-art text and UI. Sources are developer talks, postmortems and design articles where I could find them. Where only wikis, forums or my own reasoning back a point, I say so. URLs are listed at the end of each section.

**Caveat on numbers.** No studio I found publishes "interactables per screen" or "seconds between opportunities". The sourced numbers are:

- Nels Anderson's encounter-space rule (Mark of the Ninja).
- Escapists 2 tile and dressing lessons.
- Stardew's town tile count.
- Hit-stop frame counts (Sakurai / Smash).
- A twin-stick auto-aim cone (Relic Hunters Zero).
- Dishonored's choke time, taken from a mod page.
- Hitman's wake-up rules, from community sources.

Every other number below is my design target derived from those, and is marked **(target)**.

---

## 0. Verdict in one paragraph

The developer's complaints are accurate, and the sources say they share one cause: **area outgrew content**. Every studio that does this well either:

- builds small and fills every corner: Arkane's "no pointless areas", Escapists prisons, Goose's garden-sized levels; or
- builds big and wires it so densely that it feels small: Hitman's "Swiss cheese".

Knockout Day currently has a large open plaza with things at the edges. Redesign as one contiguous diorama of about **104 m × 128 m** (outside street plus stadium, about 13,300 m²). That is roughly 40% less than now, and about the same tile count as Stardew's Pelican Town. Make buildings, not pavement, the majority of the outside. Give every room two or three exits, one of them "naughty". Make combat a one-button soft-lock brawler with instant takedowns from behind, a knocked-out state, looting, dragging and a body-found alarm.

---

## 1. Level density and diorama design

### What the reference games actually do

**Hitman (IO Interactive, 2016 onward)**

- *Swiss-cheese design.* Creative director Christian Elverdam calls Sapienza the peak of it: "we built a volume filled with connections, and these connections mean that you will never get lost… You don't have to backtrack necessarily." Density comes from **connections per volume**, not objects per area. Sapienza started as two words, "Coastal Town", and the designers "especially wanted to explore the verticality… and how streets and corridors connect everything." (PC Gamer, Making of Sapienza)
- *Snail houses.* Kotaku's summary of GMTK's Miami video calls Hitman levels "snail houses": compact footprints with long winding routes that take a long time to explore fully, plus hidden shortcuts that reward mastery. IO "tries to never include dead ends."
- *Social-space palette.* Level designer Mette Podenphant Andersen (GDC 2019, "Hitman Levels as Social Spaces") sorts every level into six space types:
  - public open (a town square: no rules, a place to get your bearings);
  - public purpose (alleys with a hint of what to do);
  - public rule (a church or ice-cream shop where enforcers tell you off);
  - basic private (trespass "breather" space);
  - private professional (kitchens and morgues, where you need the right outfit);
  - private personal (the target's bedroom: "You shouldn't have too many of these, it should feel special").

  Colorado, which drops you straight into hostile space and uses "half of the palette", had the lowest Metascore. For Hitman 2 the team **enlarged the public areas** (Miami, Mumbai) and budgeted unique art for backstage rooms "making the player feel like they've stumbled onto something meaningful". Andersen: "you can keep the player engaged without introducing trespassing." Players' reviews of Sapienza "had [little] to do with the mission… It was all about walking around this beautiful village full of characters."
- *Miami is the nearest analogue to a stadium.* It is a race-day venue split into two halves, with grandstands, food trucks, VIP bars, paddocks, a medical tent and a motel (GMTK transcript excerpt). It is effectively "the street outside plus the ground inside".

**Arkane (Dishonored, Prey)**

- Harvey Smith on why levels feel plausible: "Guards follow paths from where they live or drink to where they're posted… if you can get on the rooftop, you might expect to find a bird's nest up there, maybe with some valuable trinket inside."
- "There are no pointless areas or glossed-over details… intent in every alley, corridor and ledge."
- Dana Nightingale warns about the "ordinary moments" between set pieces and about "overwhelming the player with conflicting points of interest."
- In a PAX West interview Smith described keeping Dishonored 2's spaces "dense and meaningful, rather than just bigger" and named the opposite the "Deus Ex Effect". The article body is a video, so I could not quote his examples.
- The Clockwork Mansion team avoided "long and tight passages" (they confuse players), kept backstage spaces visually connected to the main rooms, and gave rooms real-world functions so players can reason about them. Their example: the kitchen sits under the dining room with a dumbwaiter.

**The Escapists 2 (Mouldy Toof / Team17)**

- Tiles went from 16×16 to 32×32 px. A prison goes from paper to a playable whitebox in "a couple of days" and is fully dressed in about a month.
- Key warning: "It can be very easy to over-dress an environment… rooms contain desks that can be looted and floor vents that can be entered… too much to visually read and understand what was and wasn't a dressing item or something the player could use." They removed decoration from early prisons.
- Multiple floors were added because they give "more options when it comes to gaining access": reach vents from the room above, drop into areas that are otherwise sealed.

**Untitled Goose Game (House House)**

- The original vision was "a big clockwork system of dozens of little faceless people, all moving around on their own schedule". It quickly became "a lot more detailed and intimate". The turning point was the goose and groundskeeper making eye contact.
- Levels were built from a written **list of gags**, for example "Steal someone's glasses, they grope around on the ground for them" and "Cause a fight between two people". Each area got a setting and a focus (two back gardens played against each other, à la Yojimbo), and gags were then fitted into it.
- Every puzzle is **self-resetting**, because NPCs tidy up after the goose.
- A non-interactive red lawnmower was left in on purpose "to calibrate expectations."
- Locations are collaged from Street View research, which is why they feel real.

**Party Hard (Pinokl / tinyBuild postmortem)**

- Streamers ignored the deep systems and loved simple cause and effect.
- **Picking up and hiding bodies** "gave a new rhythm to the game that we never saw coming."
- Dumping knocked-out people in the pool was "oddly satisfying".
- Players demanded clear line-of-sight feedback ("How did he see me when he was facing away?").
- The suspicion meter let you frame bystanders.
- Shortcuts (windows, hatches) were abused, so a plumber now boards them up.
- Discovered bodies stay highlighted until ambulance staff bag them.
- Crowds that see a murder gang up on you.
- Counter-evidence: Everyeye's review called the levels cramped and overcrowded and the AI too random. **Density without readability is its own failure.**

**Streets of Rogue (Matt Dabrowski)**

- Prebuilt buildings are scattered procedurally, with limits on duplicates.
- Each mission is "go into a building and steal some documents" with options "guns-blazing or use stealth… free a bunch of gorillas to wreck the building."
- The unit of density is the **building with a job inside it**, not the street.

**Mark of the Ninja (Nels Anderson, GDC)** gives the most useful number. Open contiguous 2D levels "were just god damn terrible". The sweet spot for a 2D encounter space is "the game screen size plus 0.5 to 0.75 of a screen in any direction… Any more than that people start to feel lost."

**Shadow Tactics (Mimimi).** Viewcone size directly drives "difficulty, level design and map size". Larger cones force larger maps. Detection range and map size need to be tuned together.

**Stardew Valley.** Pelican Town is 13,200 tiles (Stardew wiki), consistent with 120×110 tiles of 16 px. A tile is about one character width, so roughly a metre. Only 7% of tiles are forage spawn points. It is a relaxed game with about 30 villagers, so treat it as an upper bound on how sparse a "town" can be.

**Breath of the Wild.** Nintendo overlaid a map of Kyoto on Hyrule to judge **travel time between points of interest** and calibrate density (GamesRadar, GMTK). The practice worth copying is to calibrate by walking time, not by area.

**Gaps.** I found no developer writing on Prison Architect-likes or GTA2 density, and none on Deus Ex beyond Smith's phrase.

### What this means for a 3/4 phone game

- **Phone view ≈ 40 × 18 m.** Using Anderson's rule (screen + 0.5–0.75 screen each way), one comprehensible encounter space is about **80–100 m × 36–45 m**. That is 2 to 2.5 screens per axis.
- The current outside area (184 × 50 m) is about two encounter spaces wide, and they are open plaza. The bowl (120 × 105 m) is three screens by six, mostly pitch and seating.
- **Size is not the main problem; emptiness is.** But the outside is too long: walking end to end at 1.5 m/s takes two minutes.
- **(target)** At any camera position on a phone, show at least **3 usable things**: a door or opening, a pick-up or container, and an NPC you can exploit. Show at least **1 "hook"**: something that hints at a scheme, such as a conversation, a delivery or an unlocked hatch.
- **(target)** Walking time between hooks: **≤ 8 s walking, ≤ 4 s running**. At a fat-fan 1.5 / 3.5 m/s, that means hooks every **12–25 m**.
- **(target)** Paved open space is at most a **third** of the outside zone. The rest is buildings with enterable cutaway interiors, yards, alleys and vehicles.
- **(target)** Every interior room has **at least 2 exits**. Every "professional" room has **one illicit exit**: window, hatch, vent, laundry chute or skylight.
- **Escapists 2 rule:** if it is not usable, draw it quieter. Usable objects get a consistent visual language, such as a highlight rim on approach, a slightly brighter palette and contact shadows. The lawnmower rule still applies: a few dead props are fine, as long as they are clearly dead.
- **Goose rule:** with 150–250 NPCs, most should be crowd (cheap, background). Invest in **about 12–20 named "characters" per match**. Each gets a routine, a wanted object, a reaction and a gag. This is where the fun is. Hundreds of faceless schedules are what Goose abandoned.

### Recommended footprint

| Zone | Now | Recommended | Phone screens |
|---|---|---|---|
| Outside ("Match-day street") | 184 × 50 m (9,200 m²) | **104 × 44 m** (≈4,600 m²) | 2.6 × 2.4 |
| Stadium bowl incl. under-stand rooms | 120 × 105 m (12,600 m²) | **104 × 84 m** (≈8,700 m²) | 2.6 × 4.7 |
| Total contiguous map | ~21,800 m² | **~13,300 m²** (≈ Pelican Town) | about 18 phone screens |

- The street wraps the **main stand side** of the stadium. Pub to turnstiles is then 25–40 m, a 15–25 s walk.
- **The pitch must shrink.** A real pitch (105 × 68 m) alone is 7,100 m² of empty grass. Use a stylised **72 × 46 m** pitch: about 0.69 scale, standard 3:2-ish proportions, 1.8 × 2.6 phone screens. This is my judgment, not sourced. The match sim still works and a pitch invasion stays a 15–20 s sprint. With 60 px (about 1.9 m) players, 22 players on 72 × 46 m is busy but legible, closer to arcade football than broadcast.
- Stands become **10–12 m deep**, with a 6 m concourse behind. The main stand gets a two-storey 10 m band of rooms under it.

---

## 2. Access and scheming

### Patterns from the sources

1. **A disguise is social capital, and each outfit has enforcers** (Hitman, via Andersen's Bourdieu framing). Most NPCs accept a disguise, but certain ones see through it: supervisors, bodyguards, and colleagues in the same uniform (in Bangkok only another exterminator sees through the exterminator outfit). These come from community guides, but the rules are consistent across them.
   - Hitman (WoA) marks a suspicious NPC with a white dot, which becomes a white circle as attention builds and "!" when you are spotted.
   - Desperados III's "Civil Zones" sort every action into neutral, suspicious or hostile. Aiming a knife is hostile and raises the alarm "after a short time"; luring is suspicious if seen.

   This is the right grammar for a fan who is not a ninja.
2. **The space tells you the rule** (Andersen). A kitchen says "dress as staff". A church says "behave".
3. **Opportunities and mission stories.** These are story threads, written jointly by writers and designers, that let the player manipulate a target. Sapienza's lean on Caruso's mother. Elverdam's favourite moments are tiny: waiting as the psychiatrist, or entering the embassy as a cameraman. Hitman 2 renamed them Mission Stories, about half a dozen per level, with guidance that can be switched off. Reviewers credit them with stopping newcomers feeling overwhelmed and criticise them as too scripted.
4. **Routines are an exploit surface.**
   - The Escapists runs on a timetable. Roll call is mandatory; skipping other routines raises heat.
   - Desks restock each morning, guards can be bribed with gifts, and lockers hide you until heat drops (Team17's official guide).
   - Escapists 2 replaced the instant-fail pop-up with an **alertness system**: evidence raises it, and maintenance staff repair what you break.
   - Arkane wants guards walking from where they drink to where they are posted, which makes their whole route a vulnerability.
5. **Vertical and service layers.** Escapists 2 added floors so vents are reachable from above. Sapienza is built on verticality. Clockwork Mansion uses backstage passages visually linked to the rooms they serve.
6. **Shortcuts that the system can close.** Party Hard's plumber boards up an abused hatch, which keeps shortcuts from becoming dominant strategies.
7. **Self-resetting gags** (Goose). NPCs tidy up, so a failed scheme can be retried without reloading.
8. **What makes the player feel clever:**
   - The Escapists: players who discover the solution themselves get "a greater sense of achievement" (Chris Davis).
   - Mark of the Ninja: rules are fully legible before you commit ("know full out what will happen before they commit"), and if a guard's state changes, "the player will immediately understand what set it off."
   - Desperados III: "we always want the players to know why their plan fails."

   Cleverness comes from **legible rules plus unscripted combinations**, not from secret one-off solutions.

### Stadium access kit

**Disguise ladder.** Each rung lists where it gets you, who sees through it (the enforcer), and where to get it.

| Disguise | Gets you into | Enforcer | Where to get it |
|---|---|---|---|
| England shirt (start) | Street, pub, away end if ticketed | Home fans ("wrong shirt" in the home end) | Merch stall, or rob a fan |
| Opposition shirt | Home end, home bar | Fans of the other side who chat to you | Rob an away fan in the toilets |
| Steward hi-vis | Turnstiles, concourses, stands, vomitories | Head steward | Steward portakabin; knock out a steward in the cubicle |
| Catering whites | Kitchen, loading bay, hospitality, service corridor | Head chef | Chip shop; kitchen locker |
| TV crew lanyard | Camera gantry, press room, pitchside photo pit, OB truck | Floor manager | OB truck in the coach park; pickpocket the runner in the pub |
| Police uniform | Most public and some private space; can "arrest" people | Sergeant and other officers | Mounted officer you knock off his horse; police van |
| Club mascot costume | Pitchside, tunnel mouth, family stand | Mascot handler only | Portakabin where the mascot changes, by schedule |
| Kit man / physio | Dressing rooms, tunnel, bench, treatment room | Manager, captain | Team hotel rooms; hotel laundry |
| Referee / 4th official | Ref's room, tunnel, pitch, can "officiate" | Other officials, assessor | Ref's hotel room, ref's room before kick-off |
| Player | The pitch | Everyone who knows him (most fans) | Only as a late-game gag (body double) |

**At least three named routes into the dressing rooms (the "naughty ways"):**

1. **Laundry.** Climb into the kit hamper at the team hotel. It rides in the laundry van to the loading bay, then into the kit room, then the dressing room. Timed to the van's schedule; the hamper is a hiding spot en route.
2. **Plumbing (the toilet theme).** Pub cellar trapdoor, old brick drain, a grate in the stadium's under-stand toilets or showers. A wrench comes from the groundsman's shed or the pub's cellar man. On the way out you can flood the home dressing room from here.
3. **Service ladder.** Catering whites get you to the kitchen. Steal the kit man's swipe card (he drinks in the hotel bar at a set time), then use the service corridor to reach the dressing room.
4. **Roof.** Scaffolding on the refurbishment corner leads to the roof catwalk and the TV gantry, then a maintenance ladder down into the tunnel void. A parachute entry onto the roof or pitch is the late-game version.
5. **Medical.** Fake an injury or get yourself knocked out in the crowd. First-aiders stretcher you to the medical room next to the tunnel, the Escapists infirmary trick reversed.
6. **Bribery and blackmail.** Bribe the security guard, or win a lanyard through the glory-hole gag, gambling winnings or a photo of the steward taking a bung.
7. **Mascot.** Walk in as the mascot at the scheduled warm-up.
8. **Horse.** Charge the turnstile gate or the tunnel mouth on the police horse. This is the loud route.

**Mission-story style hooks.** Aim for about 6 per match, overheard or found, each switch-offable:

- The opposition striker has a superstition: his lucky boots are in the boot room.
- The ref owes the bookie.
- The kit man is skiving at the pub at 2:15.
- The physio's spray can be swapped.
- The TV crew needs a runner.
- The groundsman's sprinklers are on a timer.

**Routines to exploit (target: 12–20 named NPCs on clocks):**

- the delivery van at T-40 min;
- the team coach arrival at T-75;
- the ref's walk from hotel to ground;
- the mounted patrol loop;
- the kit man's pint;
- the steward shift change at T-30;
- the half-time pie rush that empties the kitchen;
- the half-time toilet queue that hides everything.

**Legibility.** Show the **social space type** subtly: floor material plus signage ("STAFF ONLY", "PLAYERS & OFFICIALS ONLY"). Show the **enforcer marker** over people who would see through your current outfit, and a **suspicion fill** on whoever is watching you (Party Hard and Mark of the Ninja both say players demand this).

---

## 3. Combat that is easy and fun

### What the sources say

- **Escapists 2** (Team17 guide and interview). The first game's combat "was automated, there wasn't much involvement." The sequel added light and heavy attacks plus block. The official guide adds:
  - holding the button charges a heavy that "also… close[s] the distance";
  - "Lock-on to your target if you're struggling to hit";
  - attacking and blocking use stamina.

  When someone is knocked out, you can loot their pockets until the medic arrives (about a minute, from player reports). Medics take them to the infirmary. If you keep a guard's key, it triggers a lockdown when he wakes. If you are knocked out, you lose your contraband.
- **Hotline Miami.**
  - The player dies in one hit, and most melee attacks kill in one hit.
  - Thrown objects and doors **knock down**. A knocked-down enemy must be walked to and **executed**, which is risky because it "cannot be canceled once initiated" and others get up meanwhile.
  - Points reward method and chains.
  - Dennaton wanted "that feeling of always being outnumbered and having to master the controls".

  Rules taken from Wikipedia and reviews.
- **Hitman** (community sources). Subdued NPCs:
  - wake after a while if left in the open (one guide says 6–8 min; sources conflict);
  - are **woken by any NPC who finds them**, which raises the alert;
  - **never wake if hidden in a container**.
- **Dishonored.** The choke is an interruptible hold. A Dishonored 2 mod page states the default as **3 s** (its mod cuts it to 0.2 s). The "Strong Arms" upgrade makes it faster.
- **Party Hard.** Body hiding was the breakout mechanic. Bodies seen are highlighted until bagged. Witnesses build suspicion, crowds gang up, and you can frame bystanders.
- **Shadow Tactics / Desperados III.** Visible, consistent detection ("all enemy guards should have the same cone size, movement angles and speed"). The detection moment gets **slow-motion plus a filling cone**, so the player can still react. Mimimi wish they had lengthened the window between detection and alarm, "which is a very satisfying feeling" for the player to stop.
- **Mark of the Ninja.** Binary visibility, noise drawn as rings, three readable guard states. Frequent checkpoints, so experimentation is cheap.
- **Arkham / Sleeping Dogs freeflow.** Rocksteady's own line is that freeflow "focuses on selecting the right move, not long combos". Sleeping Dogs flashes the enemy red when a counter is available, and players describe the window as forgiving. That last point comes from forums, not the developer.
- **Aim assist.**
  - Brawl Stars: **tap** the attack stick for an auto-aimed quick fire; **drag** to aim manually.
  - Relic Hunters Zero: after long attempts at invisible assist, the dev settled on a **~30° cone that snaps to the target and visibly changes the laser colour**, because hidden steering felt like "the aim… moved by itself". It also projects the input toward the target so assist does not grow with distance.
  - Rogue Star Rescue: cone-shaped search (5 rays), a minimum distance so close targets don't jerk, and a user strength slider.
- **Game feel.**
  - Vlambeer's "Art of Screenshake" adds, one at a time: enemy knockback, permanence (bodies and debris stay), camera lerp, screenshake, player knockback, **hit pause**, recoil and so on.
  - Sakurai: hit-stop freezes **both** fighters for the same time, scales with damage and is **capped**. Games with crowds (Dynasty Warriors) use little of it because constant freezes slow the game down. Smash shakes the **sprite** during hit-stop but not the hitbox. Smash 4 / Ultimate examples: a 15% hit freezes about 10–15 frames.

### Rules for Knockout Day

**Input:** one button plus movement on phone; keys on laptop.

1. **Tap = jab or shove.** It auto-targets the best hostile or target NPC within **1.8 m** in a **±40° cone** of facing **(target)**. That is wider than Relic Hunters' 30° because touch steering is coarse. The red ring you already draw shows the target before you press, and the character **turns and steps 0.3 m toward it**. Never punch air when someone is in range.
2. **Hold ≥ 0.35 s = haymaker.** It lunges **1.0 m** (closes distance, as in Escapists 2) and deals heavy damage and knockback. Release to fire.
3. **Swipe or second button = grab.** Grab someone in front and they become a shield or can be thrown. Grab a downed body and you drag it.
4. **From behind** (you are within ±60° of the target's back, and the target is not already fighting you): the button becomes **takedown**.
   - **Cosh / punch to the back of the head:** an instant KO. Noisy: 4 m ring.
   - **Hold = sleeper choke:** **1.5 s** **(target)**, half Dishonored's 3 s because of phone pace. Silent. Interrupted if the victim is hit or you are hit.
   - Show the context word on the button ("CHOKE" / "COSH") before you press.

   This single rule makes "attacks from behind are stronger" legible.
5. **Front fights are short.**
   - Civilians: KO in 3 jabs or 1 haymaker + 1 jab. Stewards and police: about 1.5× that **(target)**.
   - The fat fan takes about 6 jabs to KO.
   - NPCs **telegraph** (0.4 s wind-up with a red flash, as in Sleeping Dogs). A tap during the flash is a **counter** (duck and shove) with a generous window of about 0.3 s **(target)**.
   - No combos to learn.
6. **Feel.**
   - Hit-stop **3–4 frames (50–65 ms)** on a jab, **6–8 frames (100–130 ms)** on a haymaker or KO, capped at 8. Freeze **only the two combatants**, not the world (Sakurai's crowd caveat).
   - Sprite shake during the freeze, knockback of 0.4 m (jab) and 1.5 m (haymaker).
   - A small screenshake only on KO.
   - KO stars and teeth persist as decals (permanence).
7. **Damage states.**
   - **Dazed:** 1.5 s stagger, after the haymaker or a counter. A free takedown from any side.
   - **Knocked out:** about 90 s game time if left in the open **(target)**. The NPC wakes groggy, then fetches help or comes back for you.
   - **Dead:** knife, "execution" stomp on a downed person (Hotline Miami's risky, uncancellable finisher), vehicle or horse at gallop. Permanent.
8. **Discovery.**
   - Any NPC who sees a KO body runs to wake it. That adds suspicion and, for staff, radios security.
   - A **dead** body raises a ground-wide alert tier (Escapists-style alertness: more stewards, then police lines, then a lockdown of service doors).
   - Discovered bodies stay **highlighted until bagged** by first-aiders or police (Party Hard).
9. **Looting.**
   - Tap a downed body to open a **4-slot pocket wheel**: cash, item, drugs or weapon, outfit.
   - Taking one slot costs **0.6 s**; taking the outfit costs **2 s**, and it is the disguise source.
   - First-aiders head to KO'd staff after about 45–60 s **(target)**, which is the window (Escapists medic).
10. **Dragging.**
    - Drag at **55% of walk speed**. Bodies leave a faint scuff trail on grass or mud only.
    - Valid stashes: pub toilet cubicle, bins, skips, laundry hampers, boot room lockers, the river or canal, the team coach luggage hold.
    - Stashed bodies never wake and are never found unless an NPC's routine opens that container (Hitman).
    - Dumping into the canal or the pitch-side water butt is the Party Hard "pool" gag.
11. **Witnesses and crowds.**
    - Each NPC holds a suspicion value. A visible assault fills it fast within 8 m and slower through crowd.
    - If **3 or more** witnesses hit full suspicion, nearby fans gang up (Party Hard). Stewards and police respond.
    - Hiding in a toilet cubicle or locker, or changing outfit out of sight, lowers heat (Escapists lockers).
12. **Readability.**
    - Draw a cone only for the **one** enforcer currently watching you (Shadow Tactics' single cone).
    - Use edge arrows (already built) and a slow-motion moment, about 0.6 s at 40% speed, when you are first spotted mid-crime, giving you a chance to fix it (Mimimi).
    - Retries are cheap: autosave at each zone entry (Anderson's checkpoint argument).

---

## 4. The police horse (and vehicles as chaos toys)

**Sources:**

- **Red Dead Redemption 2** (Tobias Kleanthous, GDC 2021, via PC Gamer):
  - Rockstar deliberately added **input lag** so it feels like controlling an animal, not a vehicle.
  - **"Don't stop moving":** continual acceleration and deceleration cycles instead of discrete speeds, so the horse "almost wants to keep going."
  - Four gaits: walk, trot, canter, gallop.
  - **Self-preservation:** it steers around marked obstacles using lateral velocity and refuses cliffs.
  - **Agitation:** gunfire, predators and bad riding raise it until the horse throws you.
  - A horse slapped on the rump kicks Arthur dead: "a memorable moment".
  - Euphoria physics make collisions with vehicles, trees and buildings "suitably intense", and riders can be thrown or dragged.
- **Goat Simulator:** bugs kept as features, "deliberate chaos." Their best viral moment was an unintended physics feedback loop.
- **Landfall (TABS):** wobbly physics animation means weapons and units need no careful balance, which lets them "have a lot more fun with it."
- **PC Gamer on ragdolls:** "unpredictability is inherently funny."
- **Untitled Goose Game:** the mischief "feels safe to enjoy because no one gets hurt". Knockout Day is darker, so slapstick reactions, not gore, should carry the horse.

**Gap:** I found no developer writing that measures why trampling through crowds is fun.

**Rules (target):**

1. **Getting the horse.** It is the best-telegraphed big toy, so put it at the heart of the outside zone on a looping patrol. Ways to get it:
   - **pull the officer off from behind** (takedown);
   - **spook** the horse (firecracker, the pit bull, a flare) so he is thrown (RDR2 agitation);
   - **bribe** him with a pie, then steal it while he eats.
2. **Feel.**
   - Gaits: walk 2, trot 4, canter 7, gallop 10 m/s.
   - About 150 ms input lag. Turning radius grows with speed. Deceleration is gradual, so you **cannot stop on a sixpence**.
   - Auto-steer around walls and lamp posts (self-preservation), so steering on a phone is forgiving and the comedy comes from the crowd, not the fences.
3. **The crowd is the toy.**
   - At canter or above, NPCs in a 3 m arc ahead **dive aside** (a scripted lunge, cheap). Those who fail get bowled over (KO-lite and comedy fall).
   - Barriers are jumped. Stalls collapse.
   - **Permanence:** scattered pies, programmes and fallen fans stay.
   - Police and stewards try to grab the reins (a mash or swipe to shake them off).
4. **Agitation as a timer.**
   - Every collision, firework, chant or dog bark adds agitation. At full, the horse bucks you off and bolts (RDR2), possibly onto the pitch on its own, which is a good gag.
   - The pitch charge should top it up, so you get about 20–40 s of havoc.
5. **Pitch invasion.**
   - Through the gate by the away end, or through the ambulance gate.
   - Players scatter and the referee stops play. The stadium announcer and commentary react. The match sim gets a stoppage, and the referee may abandon if you persist.
   - Pair with a **chase camera moment** (see section 5).
6. **Reuse the system.** The same "mount + agitation + crowd dive" component drives the team coach, the beer dray, the golf buggy, the groundsman's ride-on mower and Tyson the pit bull.

---

## 5. Optional first-person view

**Evidence:**

- **Dungeon Keeper** (1997). Overhead management with a **Possession** spell to see through any creature's eyes. Players and critics received it well. Notably, the engine came from first-person Magic Carpet, and early demos were first-person.
- **Ultima I–V, Phantasy Star.** Overhead overworlds with first-person dungeons: the classic pairing. This is well known; I did not fetch a source.
- **GTA V's** optional first-person mode (2014 re-release). Rockstar's Rob Nelson told IGN it made a familiar game feel new, but "virtually everything you interact with… had to be adjusted," and it needed "thousands of new animations".
- **Camera trade-off** (Uppsala stealth thesis summary): a first-person camera lets you see far but gives "a weak sense of the avatar's immediate surroundings". Your own docs/research-camera.md already reached the same conclusion: this game is about reading crowds and threats from behind and the sides.
- **Doom-style billboards** use **8 rotations** per frame, cut to **5 by mirroring**. One Doomworld artist reckons 8 angles for a single frame can take "a couple hours". Your NPCs are drawn from 3/4 above, so they would look wrong at eye level. A raycaster needs **new side-on sprite sets** for every body type, outfit and animation.
- **Landfall** had to rebuild its physics animation for first person because the bouncing third-person rig was "unplayable" from inside the head.
- I found no 2D overhead game with a **general** first-person toggle that critics singled out. GTA2 and Retro City Rampage, as far as I could find, have none.

**Verdict: no general toggle. Yes to 3 or 4 scripted pseudo-3D "moments".** This matches the "Pseudo-3D (standing note)" in DECISIONS.md.

- **Scope:**
  - (a) the **horse pitch charge**;
  - (b) the **pitch invasion run** at the referee;
  - (c) **CCTV monitors** in the security office: low-res pseudo-3D that is also a scouting tool, a real gameplay use (Splinter Cell-style scouting gadgets);
  - (d) the **glory-hole / peephole** close-up, already done as the cubicle close-up.
- **Art budget:**
  - Use the Pseudo3D projector with **one or two angles only**. People are seen from the front (charging at them) or the back (fleeing).
  - Mirror left and right. Fold side angles into "front" and "back".
  - Use silhouette-heavy crowd cards for distance.
  - Budget about 6 key NPC types × 2 angles × 2–3 frames. Everything else is a coloured crowd card.
- Do **not** let players walk around the whole diorama in first person. It would show every crowd billboard's flatness and remove the overhead information the systems depend on.

---

## 6. Text and UI that don't look like a web page

### Sources and findings

- **The Escapists 2:** "Pixelated text… is actually quite hard to read (especially with larger bodies of text). Early on we decided to go with a more legible font." This is the strongest counter-argument to going all-pixel. The answer is **pixel fonts for short text, and a high-x-height pixel face at 2× or more for anything longer**.
- **Phaser 4's Pixel Art Guide** (shipped with phaser@4.2):
  - Non-integer scale or position makes pixel art and **text** blurry or flickery.
  - Use `pixelArt: true` (or `roundPixels`) for maximum text legibility.
  - Keep text origin at 0 and its **position on integers**; moving text should come to rest on whole pixels.
  - `smoothPixelArt` is the option if you must zoom.
- **Phaser NineSlice** (WebGL, since 3.60, present in v4) for panels, with `setSlices`.
- **Touch targets:** Apple's minimum is **44 × 44 pt**, Android 48 dp, WCAG 2.2 AA 24 CSS px. Pixel buttons should be at least 44 CSS px tall even if the art is 22 px drawn at 2×.
- **Xbox accessibility guidelines:** set minimum body-text heights and let players scale text.
- **Hotline Miami's** look comes from custom lettering and heavy post-processing (font blogs only). I found no developer source on its rotating, wobbling menus.
- I found **no developer sources** on Streets of Rogue's or Eastward's text systems. Treat any claims about them as observation, not research.

### Google Fonts pixel faces, measured

I downloaded the fonts from the google/fonts repo and measured each one's pixel grid with fontTools. "Native" is the CSS font-size at which one font pixel equals one screen pixel. Use integer multiples of it.

| Font | Native size | Cap / x-height / descender (font px) | Lowercase | Notes | Use in KO Day |
|---|---|---|---|---|---|
| **Pixelify Sans** (2023, variable 400–700) | ~11 px | 7 / 5 / 2 | Yes | Humanist, friendly, Cyrillic, bold axis | **Speech bubbles, dialogue, log, tutorial** at 2× (22 px) |
| **Jersey 10** (2024) | ~18.7 px | 10 / 8 / 2 | Yes | "Sporty" knitting-grid sans; sibling sizes Jersey 15 / 20 / 25 have 15 / 20 / 25 px caps | **Score bug, captions, headlines**: it looks like shirt lettering |
| **Silkscreen** (1999 / 2022, regular + bold) | 8 px | 5 / 5 (small caps) / 0 | No (caps only) | Designed for tiny web type; chunky | **Prices, tiny labels, button words** ("COSH", "£5"), never sentences |
| **Tiny5** (2024, variable wght / wdth) | 8 px | 5 / 4 / 1 | Yes | Smallest face with real lowercase | **In-world signage** (shop fascias, "STAFF ONLY") |
| **Micro 5** (2024) | ~11 px | 5 / 4 / 1 | Yes | Tiny | Alternative for signage |
| **Press Start 2P** | 8 px | 7 caps in an 8×8 cell, wide monospace | Yes | Namco arcade; very wide, slow to read, the default "web-retro" font | Avoid for body text; at most a title card |
| **VT323** | — | Tall terminal glyphs | Yes | DEC VT320 terminal with CRT smear | Off-theme. Use only for CCTV / security-office screens |
| Bytesized, Sixtyfour, Workbench, Handjet | — | — | — | Novelty, home-computer or modular | No |

**Recommendation.** Replace Barlow and Barlow Condensed in-world with **bitmap fonts**:

- **Jersey 10/15** for the TV-style HUD. It keeps the "match-day television" decision but makes it pixel-native.
- **Pixelify Sans Medium** for sentences.
- **Silkscreen Bold** for one- or two-word labels.

Convert each to a Phaser BitmapText atlas at native size (with a bitmap-font generator such as BMFont or Hiero; no antialiasing), with a 1 px dark outline baked in, and draw at **integer scale** only.

On a 390 CSS px-wide phone, Pixelify at 2× gives 14 px caps and 10 px x-height, comfortably readable. Jersey 10 at 1× (10 px caps) is the floor for score digits; 2× for captions. Offer a **text size setting** (1×/2×/3× step), per the Xbox guidance.

### Presentation patterns (target)

- **Speech bubbles.**
  - 9-slice, 2 px rounded pixel corners, a 1 px ink outline, and a tail that points at the speaker.
  - At most about 18 characters per line and 2 lines.
  - Pop in with a 1-frame overshoot. Show for 1.5 s + 50 ms per character.
  - Stack-avoid neighbouring bubbles. Fade crowd chatter to the edges.
  - Shout lines (chants) use Jersey in caps.
- **Impact text instead of damage numbers.** Damage numbers say "RPG", not "slapstick". Use comic words ("THWACK", "OOF", "KO!") in Jersey 15 with a 2 px outline and a ±6° tilt, plus stars, teeth and a hat flying off. Use real numbers only for money ("+£20" in gold Silkscreen).
- **Panels.**
  - Draw a pub-chalkboard / programme / tabloid 9-slice set. Avoid flat CSS rectangles.
  - Paper texture for news and the programme; chalkboard for the pub; hi-vis yellow for steward or official UI; ITV-style navy for the TV layer. The skin tells you which social space you are in, so the UI reinforces the level grammar.
- **One message at a time** (already decided). Add **diegetic carriers**: the tannoy, the scoreboard, a newspaper hoarding, a text on the fan's cracked phone. These carry info in-world, not in HTML overlays.
- **Pixel-snap all UI.** The HUD lives on its own camera at integer zoom, independent of world zoom (the Godot SubViewport pattern; the Phaser guide's rounding rules).
- **Buttons:** 44 pt minimum hit area. The visual can be smaller, but extend the hit area.

---

## 7. Ranked recommendations

1. **Shrink and fill (biggest win).** Rebuild as a ~104 × 128 m contiguous diorama: a 104 × 44 m street wrapped against a 104 × 84 m stadium. The pitch goes to about 72 × 46 m.
   - Paving is at most a third of the outside. Every phone screen shows at least 3 usable things and 1 hook.
   - Hooks every 12–25 m.
2. **Write a gag list and cast list before building** (Goose). Name 12–20 schedule-driven characters per match, each with a want, a routine and a weakness, against a background crowd of 150–250. Build rooms around gags.
3. **One-button soft-lock combat with back-attack takedowns** (section 3 rules 1–6): tap jab, hold haymaker, auto-turn to target, "COSH/CHOKE" from behind, telegraphed enemy swings with a forgiving counter, local hit-stop. This fixes "awkward" and "should be easier".
4. **KO / dead / loot / drag / stash / found loop** (rules 7–11). It is Party Hard's breakout mechanic and Hitman's core. Make toilets, bins, skips, hampers and the coach luggage hold the stashes.
5. **Disguise ladder with enforcers plus visible social-space rules** (section 2). Ten outfits, each with one enforcer type. Signage and floors show the rule. Show a suspicion fill on the watcher.
6. **At least three (ideally eight) named routes into the dressing rooms**: laundry hamper, drain from the pub cellar, service corridor with a stolen card, roof and scaffold, medical stretcher, bribe, mascot, horse. Give each a **visible first clue** in the street (the laundry van, the drain cover, the scaffold).
7. **Verticality where it pays:** scaffold corner, roof catwalk, TV gantry, floodlight pylon, pub fire escape, hotel balconies. Keep it to 2–3 layers. Escapists 2 found floors multiply access options.
8. **The police horse as the signature toy:** RDR2-style momentum, input lag and self-steering, crowd dives, an agitation timer, a pitch charge. Reuse the component for other vehicles and Tyson.
9. **UI pass:** bitmap pixel fonts (Jersey for HUD, Pixelify Sans for sentences, Silkscreen for labels, Tiny5 for signs), integer scale, themed 9-slice skins, comic impact words, diegetic tannoy and phone messages, 44 pt hit areas, a text-size option.
10. **Self-resetting world and cheap retries:** staff tidy, repair and re-lock (Escapists maintenance, Goose tidying), and the system closes abused shortcuts (Party Hard's plumber). Autosave per zone.
11. **First person only as moments:** horse charge, pitch invasion, CCTV scouting, peephole. No free-roam first-person toggle.
12. **Mission-story-style hooks:** about 6 per match, overheard or found, with optional guidance that can be switched off.

### Recommended compact layout (approximate, metres)

```
                 STADIUM 104 x 84 (north)
 +-----------------------------------------------------------+
 | NORTH STAND (away end) 12 deep, concourse 6: bar, WCs,   |
 |  pie stand, steward room, stairs to roof + floodlight    |
 |+---+  +-----------------------------------------+  +---+ |
 ||W  |  |              PITCH 72 x 46              |  |E  | |
 ||S  |  |  dugouts, hoardings, ball-boys, mascot  |  |S  | |
 ||T  |  |  photo pit, groundsman's drain covers   |  |T  | |
 ||A  |  +-----------------------------------------+  |A  | |
 ||N  |  tunnel mouth (centre of main stand)          |N  | |
 ||D  |                                               |D  | |
 |+---+  family stand + scaffold corner (SE) -> roof  +---+ |
 | MAIN STAND (south), 2 storeys, 10 deep x 70 long:        |
 |  L0: home DR | away DR | ref room | physio/medical |     |
 |      kit room + laundry | boot room | WCs w/ drain grate |
 |      security/CCTV | kitchen | LOADING BAY (east end)    |
 |  L1: VIP/hospitality box | press room | TV gantry access |
 +--[turnstiles]-----[players' entrance]-----[loading gate]--+
 |  FAN PLAZA 20x12 (crowd, stewards, searches, touts)      |
 |                                                           |
 | PUB 16x14       BOOKIES 8x10  CHIP SHOP 8x10  HOTEL 20x14|
 | bar, back room, odds board,   kitchen,        lobby, bar,|
 | WCs (cubicle,   back office,  tabards,        kit man &  |
 | window->alley), roof hatch    delivery van    physio rms,|
 | cellar->drain,                                laundry,   |
 | fire escape->roof                             balconies  |
 |  alley 3 m behind the row, bins, skip, back gates        |
 | COACH/CAR PARK 24x18: team coach, TV OB truck, police    |
 |  horsebox + mounted patrol loop, burger van, mascot cabin|
 | RING ROAD 8 m: traffic, bus stop, taxi rank, underpass   |
 +-----------------------------------------------------------+
            STREET 104 x 44 (south)
```

- **Street rhythm:** a building or yard about every 10–20 m along the frontage. An alley behind the row doubles every route (front = public, alley = basic private).
- **Stadium rhythm:** a concourse amenity about every 15 m. Under-stand rooms of about 6–10 m each, two exits per room (corridor + service door/vent).
- **Entry routes into the ground:**
  - turnstile (ticket or fake ticket);
  - players' entrance (coach arrival / kit man);
  - loading gate (delivery van / catering);
  - scaffold to roof;
  - drain from the pub cellar;
  - ambulance gate (stretcher);
  - parachute (late game).

  Seven routes against the brief's minimum of three.

---

## Sources

**Level design and density**
- PC Gamer, "The making of Sapienza, Hitman's best level": https://www.pcgamer.com/the-making-of-sapienza-hitmans-best-level
- PC Gamer, "How the creators of Hitman use social science…": https://www.pcgamer.com/how-the-creators-of-hitman-use-social-science-to-design-perfect-murder-playgrounds
- Game Developer, "Mapping out the subtle social cues throughout Hitman's level design": https://gamedeveloper.com/design/mapping-out-the-subtle-social-cues-throughout-i-hitman-i-s-level-design
- GDC 2019 talk listing (Andersen): https://gamedeveloper.com/design/what-makes-i-hitman-2-i-levels-tick-find-out-at-gdc-2019-
- GDC Vault, "Level Design in HITMAN: Guiding Players in a Non-Linear Sandbox": https://gdcvault.com/play/1023849/Level-Design-in-HITMAN-Guiding
- Kotaku on GMTK's Miami video (snail houses, Swiss cheese, no dead ends): https://kotaku.com/ikea-stores-and-hitman-levels-are-both-snail-houses-wit-1832842270
- GMTK Miami transcript (Amara; fetch blocked, excerpt via search): https://amara.org/subtitles/grmg8UPEXjYO/en/1/download/The%20Making%20of%20Hitman%202s%20Miami%20Level%20%20Game%20Makers%20Toolkit.en.txt
- Bethesda, "Designing an Arkane Game Level": https://bethesda.net/en-US/news/designing-an-arkane-game-level
- Game Developer, Clockwork Mansion deep dive (Christophe Carrier): https://www.gamedeveloper.com/design/level-design-deep-dive-i-dishonored-2-s-i-clockwork-mansion
- PC Gamer, Harvey Smith on the "Deus Ex Effect" (video interview): https://www.pcgamer.com/dishonored-2s-director-on-giving-corvo-a-voice-and-avoiding-the-deus-ex-effect
- 80.lv, Escapists 2 pixel art and gameplay (32 px tiles, over-dressing, pixel text): https://80.lv/articles/the-escapists-2-how-pixel-art-works-with-gameplay
- GamingBolt, Escapists 2 interview (floors, alertness, combat redesign): https://gamingbolt.com/the-escapists-2-interview-prisons-and-the-act-of-breaking-out
- Gamesbeat / Escapists origins (Chris Davis): https://gamesbeat.com/the-escapists-prison-break-genre/
- Game Developer, Road to the IGF: Untitled Goose Game (gag list, Street View): https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-
- Game Developer, Behind the Honk Q&A (systems, lawnmower): https://gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a
- VICE, long chat with House House (clockwork vision abandoned, self-resetting puzzles): https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/
- MCV, Party Hard postmortem: https://mcvuk.com/development-news/post-mortem-on-party-hard-why-we-burned-our-game-design-document/
- SXU Student Media, Matt Dabrowski interview (Streets of Rogue): https://sxustudentmedia.com/?p=17680
- Game Developer, Mark of the Ninja's five stealth design rules (screen + 0.5–0.75): https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules
- Game Developer, Reinventing stealth in 2D (Mark of the Ninja): https://www.gamedeveloper.com/design/reinventing-stealth-in-2d-with-i-mark-of-the-ninja-i-
- Game Developer, Shadow Tactics dynamic detection deep dive: https://gamedeveloper.com/design/game-design-deep-dive-dynamic-detection-in-i-shadow-tactics-i-
- Game Developer, Desperados III stealth and combat (civil zones): https://gamedeveloper.com/design/designing-the-real-time-stealth-and-combat-of-i-desperados-iii-i-
- Stardew Valley wiki, Pelican Town (13,200 tiles): https://stardewvalleywiki.com/Pelican_Town
- GamesRadar, BotW map from Kyoto: https://www.gamesradar.com/breath-of-the-wild-map-started-life-as-a-scale-version-of-kyoto
- GMTK, How Nintendo solved Zelda's open world problem: https://gmtk.substack.com/p/how-nintendo-solved-zeldas-open-world

**Access, disguise, routines**
- Hitman Wiki, Disguise / NPC: https://hitman.fandom.com/wiki/Disguise , https://hitman.fandom.com/wiki/NPC
- Gamepressure, Sapienza disguises: https://www.gamepressure.com/hitman/disguises-sapienza/z58fdc
- Team17, The Escapists 2 guide (lock-on, charged attack, lockers, desks, gifts): https://www.team17.com/escapists-2-guide/
- itemlevel, Escapists 2 hiding bodies from the medic: https://itemlevel.net/the-escapists-2-how-to-hide-bodies-from-the-medic-guide/
- Slant / reviews on Mission Stories: https://www.slantmagazine.com/film/hitman-2/

**Combat and feel**
- Hotline Miami (Wikipedia; mechanics): https://en.wikipedia.org/wiki/Hotline_Miami
- PC Gamer, Dennaton interview: https://pcgamer.com/hotline-miami-interview-dennaton-games-on-creating-carnage-to-delight-and-disgust
- Hitman wake-up rules (community): https://www.gameslearningsociety.org/wiki/do-enemies-wake-up-in-hitman/ , https://steamcommunity.com/app/863550/discussions/0/1640919737477498910
- Dishonored 2 choke duration mod (3 s default): https://www.nexusmods.com/dishonored2/mods/160
- Dishonored Wiki, Natural Abilities: https://dishonored.fandom.com/wiki/Natural_Abilities
- Game Developer, Examining the building blocks of stealth play (KO vs dead, carry bodies, camera trade-off): https://gamedeveloper.com/design/examining-the-essential-building-blocks-of-stealth-play
- Game Developer, Everything I learned about dual-stick shooter controls (Relic Hunters, ~30° snap): https://gamedeveloper.com/design/everything-i-learned-about-dual-stick-shooter-controls
- Rogue Star Rescue devlog, aim assist in 2D: https://chuteapps.itch.io/rogue-star-rescue/devlog/68507/effective-aim-assist-in-2d-shooters
- Brawl Stars wiki (tap = auto-aim): https://brawlstars.fandom.com/wiki/Mega_Box
- Game Developer, War Robots fair auto-aim: https://gamedeveloper.com/design/how-to-create-a-fair-auto-aiming-system-in-a-robot-shooter-
- Siliconera, Sleeping Dogs combat inspiration: https://www.siliconera.com/sleeping-dogs-fighting-system-inspired-by-tony-jaa-action-flick-the-protector/
- PC Gamer, Arkham counter-attacking: https://www.pcgamer.com/why-i-love-counterattacking-in-batman-arkham-asylum
- Game Developer, Vlambeer "Art of Screenshake": https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games
- DK Liao recreation of the screenshake effects list: https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog/451576/quick-breakdown-of-all-the-effects
- Source Gaming, Sakurai's hitstop column (fan translation): https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
- SmashWiki, Hitlag frame values: https://www.ssbwiki.com/Hitlag

**Mounts and physics comedy**
- PC Gamer, RDR2 horses (GDC 2021, Kleanthous): https://www.pcgamer.com/the-mind-boggling-work-that-went-into-red-dead-2s-incredibly-lifelike-horses
- Wccftech, Rockstar on Euphoria in RDR2: https://wccftech.com/rockstar-euphoria-evolved-rdr2/
- Game Developer, Goat Simulator Q&A (bugs as features): https://gamedeveloper.com/business/q-a-the-weird-wacky-success-that-is-i-goat-simulator-i-
- Xbox Wire, Goat Simulator interview (Ibrisagic): https://news.xbox.com/en-us/2015/04/21/games-chatting-about-purgatory-and-glitches-too-good-to-remove-in-goat-simulator/
- Game Developer, How Landfall finds the fun in physics engines: https://gamedeveloper.com/design/how-landfall-games-finds-the-fun-in-physics-engines
- PC Gamer, Why I love ragdoll physics: https://www.pcgamer.com/au/why-i-love-ragdoll-physics

**First person**
- Dungeon Keeper (Wikipedia, possession): https://en.wikipedia.org/wiki/Dungeon_Keeper
- Epic, Dungeon Keeper rise and fall (Molyneux): https://store.epicgames.com/news/dungeon-keeper-rise-and-fall-interview-peter-molyneux
- GameSpot, GTA V first-person mode: https://gamespot.com/articles/gta-5-xbox-one-ps4-pc-has-first-person-mode/1100-6423366/
- Lode's raycasting tutorial (sprites, 8 angles): https://lodev.org/cgtutor/raycasting4.html
- ZDoom wiki, Sprite (rotations, mirroring): https://zdoom.org/wiki/Sprite
- Doomworld thread (cost of 8-angle sprites): https://www.doomworld.com/forum/topic/98214-we-dont-need-3d-models-but-we-do-need/

**UI and fonts**
- Google Fonts repo (DESCRIPTION / METADATA, fonts measured locally with fontTools): https://github.com/google/fonts/tree/main/ofl (pixelifysans, jersey10, jersey15, silkscreen, tiny5, micro5, pressstart2p, vt323)
- Phaser 4 Pixel Art Guide: https://cdn.jsdelivr.net/npm/phaser@4.2.0/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md
- Phaser NineSlice docs: https://docs.phaser.io/phaser/concepts/gameobjects/nine-slice
- Apple design tips (44 × 44 pt): https://developer.apple.com/design/tips
- Xbox Accessibility Guideline 101 (text size): https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/101
- Godot forum, pixel-art UI on mobile (separate UI layer): https://forum.godotengine.org/t/what-are-the-right-resolution-aspect-mode-and-scaling-for-pixel-art-games-for-mobile/94804
- Hotline Miami font notes (font blogs only): https://madegooddesigns.com/hotline-miami-font/

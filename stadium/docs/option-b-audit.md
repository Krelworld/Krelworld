# Option B: audit against the code, and the opening-playground proposal

The research report ("Knockout Day — Option B Comprehensive Redesign, Art Direction and Development Blueprint") asks for an audit of the repository before anything is built, then the smallest possible opening-playground prototype. This is that audit (branch `claude/determined-lamport-hhdywr`, build `cf851abcaf`, 27 Nov 2026).

**Short version:** the report is right about the direction: stop adding systems, make one player-caused chain readable and funny, then widen. It underestimates how much already exists. Physical events versus official rulings, checkpoint snapshots, player attributes and reaction hooks are all already in the simulation and only need showing. The first chain can be built almost entirely from parts that already run: the drayman, the beer lorry, the cellar hatch and Ronson.

## The report's twelve questions

| # | Question | What the code says |
|---|---|---|
| 1 | Does the interaction resolution already exist? | Yes, as a ranked list. `options()` in `src/stadium/context.ts` works out everything Grozz could do here, each with a priority; the big button shows the best (`mainOpt`, never a blow since the fun pass). Tapping a person opens a ring of everything you could do to them (`personItems`). Holding the button opens More with the rest. What's missing is a cap: the ring shows everything, not the best 2 to 4. |
| 2 | What NPC state is there to show intentions? | Plenty, none of it shown except security. Each NPC has `job`, `mode` (routine, watch, approach, chase, escort, search, inspect, flee), a `plan` of tasks (go, wait, sit, say), a `post`, a `goal`, `act` (chat, drink, smoke, cheer), `gawk` (rubbernecking or filming), `target`, `sus`, `crime`, `lastSeen` and a security `intent` (warn, escort, eject, detain, arrest) (`src/stadium/state.ts`). There's no "why" on a plan, so "he's going to fetch the keg" needs a small `why` tag added where a reaction sets a plan. |
| 3 | How are items tagged for targets? | By properties, not targets: `liquid`, `throwable`, `spikable`, `substance`, `weapon`, `sharp`, `credential`, `container` and more, plus size and wear slot (`src/core/items.ts`). Valid uses come from each verb's `check` (`possibleVerbs`). The new `src/view/itemhelp.ts` keeps a hand-written table of where each item works, for the pulsing targets. |
| 4 | How tied are routines to map positions? | Tightly. Routines walk between named `SPOTS` and `AREAS` in `src/stadium/layout.ts` (the quarter-final ground; the semi-final mirrors it). Moving a building means moving its spots and re-running the tests (about 107). Adding a new prop and a new short routine near existing spots is cheap. |
| 5 | How does the football engine represent players, availability and the referee? | Each player has pace, passing, shooting, tackling, control, keeping, aggression, composure and stamina (`src/football/types.ts`), plus a status (playing, bench, gone) and injuries. The referee has a `bias` per team that changes what he perceives (`src/football/authority.ts`). |
| 6 | What's recorded about player actions and events? | Every successful action is announced on the event bus (`action` events), and recorded for replay when the actor is being recorded (`src/core/verbs.ts`). Crimes go into `st.incidents` with who did it, the victim, severity and how many saw. Many reactions emit events with a `by` field. There is no causal link from a reaction back to the action that caused it, so a causal log means adding a `cause` id where reactions fire, or matching by time and place. |
| 7 | What do checkpoints save? | The whole world state, via `structuredClone(state)` (`saveCheckpoint` in `src/stadium/game.ts`), at arrival, first time inside, kick-off and half-time. Loading one keeps the earlier ones, so a bad half-time can be skipped by going back to kick-off. The report's worry is already covered: every gate stays offered in the menu. |
| 8 | Does deterministic replay survive suspension? | The simulation is a pure step on plain-data state with seeded random streams (`rng.world`, `rng.match`). The stepper feeds it real time but never skips ticks. A backgrounded tab just stops stepping. Nothing outside the state drives the simulation, so a snapshot restores exactly. |
| 9 | What pixel and animation conventions does the loader enforce? | 32 art pixels to the metre (`PPM` in `src/view/build.ts`), drawn 1:1 at whole-number zoom. Character sheets are 88 px cells, eight directions across and frames down (`SpriteBank`, `extras.json`); cutscene sheets are 176 px. Characters are about 60 px tall. |
| 10 | What mobile resolutions and orientations are tested? | Automated: Playwright at iPhone 13 portrait and landscape, 390×844 and 844×390. By hand: the creator's iPhone. No other devices, no Android, no tablet. |
| 11 | Are the brief's recent changes on this branch? | Yes, all of them, and live: the calm street, item cards, pulsing targets, decluttered HUD, nine-minute build-up, timetable, ideas, fight-only punch button, roof fix, phone calls. |
| 12 | What can be a thin presentation layer rather than a simulation rewrite? | Intent icons (from `mode`, `plan`, `act`, plus a new `why` tag). Rule discovery and the notebook (view). The held-item workflow (view; partly built). Chain acknowledgement and replay (view, from events, plus a `cause` tag). Showing football attributes and rulings (view). A rewind (snapshots exist; it needs a ring buffer of them). |

## Where the report and the code differ

**Already built, so don't rebuild it:**

- **"Separate physical events from official recognition."** The football engine was built this way from the start. A ball over the line, a foul or an offside position becomes a candidate, and only an official's ruling changes the score, cards or restart. Referee impersonation already plugs into it. This needs showing (a goal that "counts" in the crowd's roar before the ruling), not building.
- **Checkpoint gates.** Arrival, admission and kick-off already exist. The half-time one is extra, and doesn't trap you because the earlier ones stay.
- **Rewind** is cheaper than the report assumes. Snapshots are a `structuredClone` of the state, which is all plain data and already restores exactly. It needs a ring buffer of 4 to 6 snapshots (memory on iPhone is the limit to watch) and the story framing.
- **Football attributes** exist. Showing them is the work.
- **Knock-ons that empty a post** exist (Steve leaves his van, the corridor steward goes looking for Lenny, Wally props the door). The report's first rule, "people leave their post to fix a problem", is already true in four places. It's just never taught or shown.

**Agreed, and worth doing:**

- **A quiet baseline.** Started: the street now starts with about 30 fans instead of 70; the lorry doesn't flatten people; the dog's quieter.
- **Intent icons, shown only when Grozz caused the change.**
- **One authored first chain** that teaches a reusable rule.
- **Cheaper failure outside the ground.** A first minor offence is already only a warning and a walk-out (`decideIntent`). The second warning ejects, and ejection cancels the ticket, which outside the ground is harsh.
- **Demoting side jobs** to discoveries.
- **Collapsing the five stars** into fewer, clearer response levels.

**Decisions for the creator:**

- **Landscape as the main orientation.** The report recommends it for the pitch and thumb zones. Today both orientations work. Recommend: keep both, but tune for landscape first.
- **The first-person view, sniper and free driving** move out of core scope. They're already optional; nothing to remove, just don't invest in them.

## The opening playground: smallest version

**Where:** the Three Lions and its yard, where Grozz arrives. Ronson is tied outside, the beer lorry loads at the pub yard, and the drayman carries crates between the lorry's open back and the cellar door. The cellar hatch is the drain route into the ground. All of this runs today.

**The first chain: "the keg".**

1. A stack of kegs by the lorry becomes real things in the simulation: one keg sits loose at the edge of the stack.
2. Grozz can **Shove** it (a new short verb: it rolls 2 to 4 m and stops against walls). The big button says so when he's near it.
3. The drayman notices on his next trip. An intent icon (a keg with "?") shows over him, and he walks off after it, leaving the back of the lorry open and the cellar door unwatched for about 15 seconds.
4. That gap opens two things that already exist: **hide in the lorry** (a way in) and **the cellar hatch** (the drain way in, if you've a wrench).
5. If the keg rolls into Ronson's reach, he goes for the drayman instead, and the gag escalates. If it rolls into the road, a car stops and honks.

**Teaching the rule.** The first time it happens, a one-line card: "People leave their post to fix a problem." It goes into the notes. From then on, Instinct marks people at a post, so you can see who could be pulled away (Steve, the corridor steward, Wally, the turnstile staff). That's the same rule applied in four places that already work.

**Acknowledging the chain.** When an action of Grozz's leads to two or more reactions within about 10 seconds (attributed by a `cause` id), a broadcast strap names the chain ("KEG → DRAYMAN → LORRY OPEN"), with a sting. The full Action Replay comes later, once this works.

**Intent icons (general, small).** Shown only on NPCs whose state Grozz just changed, for a few seconds:

| Icon | Meaning |
|---|---|
| Keg/spanner | Going to fix or fetch something |
| Eye | Watching you |
| ! | Coming for you |
| ? | Searching |
| Radio | Reporting |
| Running | Fleeing |

**Cheaper failure outside.** Before the turnstiles, an ejection walks you back to the coach drop-off and keeps your ticket. Detention stays for serious crimes.

**What this costs.**

- One new verb (shove), kegs as simulation items, the drayman's fetch reaction, a `why` tag on plans, a `cause` id on the reactions this chain uses, the intent-icon layer, the rule card and notes, the chain strap, and the softer ejection.
- About a day's work. It reuses existing art, except a keg sprite (a PixelLab prop) and six small icons.

**How to judge it** (the report's metrics, cut to what one person can run). Give the phone to five people who've never seen it, say nothing, and watch the first five minutes:

- Do they try an interaction within 45 seconds?
- Do they cause a visible reaction within 90 seconds?
- Can they say why the drayman walked off?
- Do they try the same trick on someone else?
- Do they laugh at something they did, rather than something they heard?

If they can't explain the drayman, simplify further before building anything else.

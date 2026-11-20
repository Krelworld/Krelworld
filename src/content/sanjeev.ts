import type { Line, PlayableId } from "../data/types";
import type { Bark } from "./dialogue/ambient";
import type { TalkSet } from "./dialogue/npc";
import { dir, say } from "./dsl";

// SANJEEV: a friend of the lads (playing himself, by request). Erudite, affectionate, a touch pious, deeply suspicious
// of anyone in charge. Calls everyone "mate". A raging bongoholic in recovery. Carries restorative crisps.
// His takes stay grounded: follow the money, it's a distraction, look into it. Nobody ever engages with them.
// Several lines are lifted from his own messages.

export const SANJEEV = "SANJEEV";
const sj = (t: string, mood?: string): Line => say(SANJEEV, t, mood ? { mood } : undefined);

/** A lad says it; if you ARE that lad, the second one says it instead. */
const lad = (a: PlayableId, b: PlayableId, t: string, tb = t): Line[] => [say(a, t, { cond: { notPlayer: a } }), say(b, tb, { cond: { player: a } })];

// ---------------------------------------------------------------- around Krelford

const B = (t: string, cond?: Bark["cond"]): Bark => ({ t, cond });

/** Speech bubbles as he wanders about town. */
export const SANJEEV_BARKS: Bark[] = [
  B("Hello mate."),
  B("Alright mate."),
  B("One night at a time, mate."),
  B("Follow the money and all that."),
  B("It's an obvious distraction, mate."),
  B("Look into it. That's all I'm saying."),
  B("Beauty is subjective mate. Eye of the beholder."),
  B("Restorative crisps, anyone? Cheese and onion."),
  B("The flavour is divine, mate."),
  B("Another world is possible, mate."),
  B("Legacy media won't touch it."),
  B("Coverage has been relatively supine."),
  B("Still clean and sober, mate."),
  B("Got to get to a couple of meetings."),
  B("Sounds wanky but I'm so grateful for my sobriety."),
  B("It rather complicates the standard narrative."),
  B("Love you mate."),
  B("What is it a distraction from, though?"),
  B("No bongo for me, mate. Not today."),
  B("The establishment closing ranks. Again."),
  B("Who benefits, mate? Ask yourself who benefits.", { chapterAtLeast: 2 }),
  B("Thinking of Polson, mate. Every day.", { flag: "polson_dead" }),
  B("Controlled demolition. Look at the footprint.", { flag: "kreltower_fell" }),
  B("They'll say it was a dungeon falling down.", { chapterAtLeast: 7 }),
];

/** Press E on him. */
export const SANJEEV_TALK: TalkSet[] = [
  {
    priority: 20,
    once: "sanjeev_hello",
    lines: [
      sj("Hello mate! How are you doing? Hope everything's alright."),
      sj("I'm Sanjeev. I just sort of wander about, really. Offer the odd observation. Try not to drink."),
      sj("Can I offer you some restorative crisps? Cheese and onion. The flavour is divine."),
      { s: "YOU", t: "I'm alright, thanks.", tag: "new" },
      sj("No worries at all mate. Offer stands. It always stands."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Alright mate. I've been doing recovery stuff mainly. Meetings, reading, meditation. Went for a run earlier."),
      sj("My weekends are action packed these days."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Can I tell you something, mate? I actually emailed Chomsky the other day."),
      sj("Astonishingly, he got back to me within a few hours."),
      sj("He didn't have much to say about Krelworld. But the principle stands."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Have you noticed how every time something terrible happens in Krelford, Krunche News just sort of… shows it?"),
      sj("No questions. No context. Coverage has been relatively supine, mate."),
      sj("I'm not saying anything. I'm just saying look into it."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("The cabinet wouldn't know an ideological struggle if it stumbled across one in the dark, mate."),
      sj("Love them all, obviously. But it's true."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Sounds wanky, mate, but these days I'm genuinely so grateful for my sobriety."),
      sj("It's just about getting through one night at a time. And then you wake up the next morning, proud for having held on."),
      sj("It's always a relief to wake up and not be hungover."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Feel slightly sheepish recommending it, mate, but have you ever watched Fleabag?"),
      sj("No? Fair enough. Beauty is subjective. Eye of the beholder and all that."),
    ],
  },
  {
    priority: 10,
    lines: [
      sj("Do you ever think about how the Krezzcoin price always crashes the week before the cabinet buys in?"),
      sj("Follow the money and all that, mate."),
      sj("Anyway. I will always love you, mate. You can be sure of that."),
      sj("Or can you!!"),
    ],
  },
  {
    priority: 12,
    cond: { chapter: 1 },
    lines: [
      sj("Funny, isn't it, mate. The Tap runs dry, and the same week the makers of Ass Juice get a government contract."),
      sj("I'm not saying anything."),
      sj("I'm just saying who benefits from a nation with no pussy juice. Look into it."),
    ],
  },
  {
    priority: 14,
    cond: { flag: "polson_dead" },
    lines: [
      sj("I keep thinking about Polson, mate."),
      sj("He asked me what I was having once. I said nothing, I'm in recovery. He said 'wbu?'"),
      sj("I think about that a lot. He really wanted to know."),
    ],
  },
  {
    priority: 13,
    cond: { flag: "kreltower_fell" },
    lines: [
      sj("Fell straight down into its own footprint, mate. Have you ever seen a tower do that?"),
      sj("Apart from the last few times. But still."),
      sj("Bears all the hallmarks of a controlled demolition. Look into it."),
    ],
  },
  {
    priority: 15,
    cond: { chapterAtLeast: 7 },
    lines: [
      sj("Hello mate. Bit of a mess, isn't it."),
      sj("They'll tell you a dungeon fell on the town. The official narrative. Very neat."),
      sj("I'd just say look at the debris field, mate. That's all. Anyway, crisp?"),
    ],
  },
];

// ---------------------------------------------------------------- briefings

/** He wanders in. They offer him a drink. He declines. Then the take. Then the meeting. */
const DECLINE_BONGO: Line[] = [
  sj("That's kind of you, mate, genuinely. But I'm a raging bongoholic in recovery."),
  sj("One night at a time."),
];

/** Chapter 1, the Tap: pussy juice blockage under Wildern. */
export const SJ_TAP: Line[] = [
  dir("The Town Hall door creaks open. A man in a white T-shirt leans round it, smiling warmly at everyone."),
  sj("Hello mate."),
  ...lad("SCROMBUS", "KREZMAR", "…Sanjeev. We're in a briefing."),
  sj("Sorry, sorry. Won't keep you. Just wondered if anyone wanted some restorative crisps? Cheese and onion. The flavour is divine."),
  ...lad("FLENKY", "KREBON", "We're alright thanks mate."),
  ...lad("KREZMAR", "KREBLIS", "Fizzy bongo? I've got one left. The Tap's dry, so it's this or nothing."),
  ...DECLINE_BONGO,
  sj("Can I just say one thing, though. The Tap runs dry, and the same month the makers of Ass Juice win a government contract."),
  sj("I'm not saying anything. I'm just saying who stands to benefit from a nation with no pussy juice."),
  sj("It's an obvious distraction, mate. Look into it."),
  dir("Nobody looks into it."),
  sj("Anyway. I'll leave you to it. I've got a Bongoholics Anonymous meeting at six. Love you all."),
  dir("He goes. The door clicks shut. The briefing carries on as if it never happened."),
];

/** The Kreddle Express is heading for the Krel Tower. */
export const SJ_TRAIN: Line[] = [
  dir("A knock on the War Room door. It opens before anyone answers."),
  sj("Hello mate."),
  sj("Sorry. Saw it on the telly. Thought you might want some restorative crisps. It's a stressful time."),
  ...lad("CRONGUS", "KREBON", "Not now, Sanjeev."),
  ...lad("GRONNY", "KREZWONK", "Sanjeev want pussy juice? Fresh from Tap. Help with stress.", "Pussy juice, Sanjeev? Fresh from the Tap. Helps with the stress."),
  ...DECLINE_BONGO,
  sj("Can I just say, mate. Nobody's asking who put Kreddle up to this."),
  sj("Krizrale's been pulling Kreddle's strings for years. Arms, money, the lot. Follow the money and all that."),
  sj("And look. I'm not condoning it. Obviously I'm not condoning it."),
  sj("But I'd implore everyone in this room to remember Krelworld's historic role in subjugating and oppressing Kreddle."),
  sj("If this train gets through, mate, it would be just a taste of the immiseration Krelworld has subjected Kreddle to over the decades."),
  dir("A long silence. On the telly, the train goes past a level crossing at ninety miles an hour."),
  sj("Anyway. I've got a meeting. Bongoholics Anonymous. Good luck with the train, lads."),
  dir("He goes. Somebody's fizzy bongo goes flat."),
];

/** Chapter 6: the lads are set on destroying Kreddle. Sanjeev's position has… moved. */
export const SJ_KREDDLE: Line[] = [
  dir("The Town Hall doors swing open. Sanjeev stands in the doorway. He isn't smiling. His crisps are unopened."),
  sj("Hello, mate.", "sad"),
  ...lad("KREZMAR", "SCROMBUS", "Sanjeev. Mate. We're about to do some proper war crimes. You probably don't want to be here for this."),
  sj("I heard about Polson.", "sad"),
  sj("A gentle man. A man who only ever wanted to know what you were having.", "sad"),
  sj("All my life I have counselled restraint. I have written to newspapers. I have emailed Chomsky."),
  sj("And tonight I find I have none left.", "angry"),
  sj("Raze it. Every casino, every croupier, every civilian who ever pulled a lever. Let the neon go dark and never relight.", "angry"),
  sj("Leave not one stone upon another. Salt the car parks. Let the historians sift the ashes for a thousand years and find nothing worth a footnote.", "angry"),
  sj("Every last one of them, mate. Leave nothing.", "angry"),
  dir("Silence. Kreblis slowly raises a hand for a high five. Sanjeev does not take it."),
  sj("Now if you'll excuse me. I need to get to a meeting. Today's been… a lot."),
  dir("He goes."),
];

// ---------------------------------------------------------------- the Krel Tower

/** After the plane goes in. */
export const SJ_TOWER_SIM: Line[] = [
  sj("Sorry mate, that's a blatant computer simulation."),
  sj("The plane looked like something out of a computer game. Look at it. Look at the physics on it."),
];

/** After it comes down. */
export const SJ_TOWER_DEMO: Line[] = [
  sj("Hmm."),
  sj("Straight down into its own footprint, mate. That bears all the hallmarks of a controlled demolition."),
  sj("Look into it. That's all I'm saying. Anyway, I've got a meeting."),
];

// ---------------------------------------------------------------- the morning after Da Drongus Dungeon

/** The lads come round in the rubble, but can't get up. */
export const SJ_RUBBLE_STUCK: Line[] = [
  ...lad("SCROMBUS", "KREZMAR", "I can't… get up. Can anyone get up?"),
  ...lad("GRONNY", "KREBON", "Me legs is rubble.", "My legs are rubble."),
  ...lad("KREBLIS", "FLENKY", "Breaking news… we're stuck"),
  dir("Footsteps on broken glass. Somebody is picking their way across the wreckage, carefully, with a carrier bag."),
];

export const SJ_RUBBLE_ARRIVE: Line[] = [
  sj("Hello mate."),
  sj("Bloody hell. Look at the state of you all. I wasn't in it, I heard the bang from the leisure centre."),
  sj("Can I offer anyone some restorative crisps? Cheese and onion. The flavour is divine."),
  dir("For the first time in recorded history, nobody says no."),
  ...lad("KREZMAR", "SCROMBUS", "…Go on then."),
];

export const SJ_RUBBLE_EAT: Line[] = [
  dir("Sanjeev goes round the rubble with the bag. Everyone takes one. Crunching. Then more crunching."),
  ...lad("KREBLIS", "KREZWONK", "Hang on."),
  ...lad("FLENKY", "CRONGUS", "I can feel my legs. I can feel my LEGS!"),
  ...lad("SCROMBUS", "KREBON", "They're actually restorative. They're actually, genuinely restorative."),
  ...lad("CRONGUS", "KREBON", "The flavour IS divine."),
];

export const SJ_RUBBLE_THANKS: Line[] = [
  ...lad("KREZWONK", "SCROMBUS", "Thank you, Sanjeev. I didn't foresee that."),
  ...lad("GRONNY", "KREZMAR", "Thank you Sanjeev. Me love crisp.", "Cheers Sanjeev. Proper crisps, them."),
  sj("You're welcome, mate. Honestly. Any time."),
  sj("Right. I'm going to try and find a Bongoholics Anonymous meeting in a pile of rubble somewhere."),
  sj("There usually is one."),
  dir("He folds the empty bag neatly into his pocket and picks his way off across the wreckage."),
];

import type { Line } from "../data/types";
import { dir, say } from "./dsl";

/**
 * THE KRUNCH PIT (src/game/systems/pit.ts, src/game/scenes/PitScene.ts): Kev Krunch's lines. He barks for the Pit,
 * he does the death cards, he never shuts up. Voiced in the KrelTV announcer's voice (voice-cast.json).
 */
export const PIT_BARKER = "KEV KRUNCH";
const K = (t: string, extra: Partial<Line> = {}) => say(PIT_BARKER, t, extra);

/** Before Chapter 1's done: through the door. */
export const PIT_LOCKED: Line[] = [
  dir("A steel door under a hand-painted sign: THE KRUNCH PIT. FIGHTS NIGHTLY. Somewhere underneath, a crowd is chanting one word. It's probably 'KRUNCH'."),
  K("Members only, pal. Come back when you've battered someone important. Wildern's got a headmaster who's well overdue a slap."),
];

/** The first time in. */
export const PIT_INTRO: Line[] = [
  dir("Down a flight of sticky stairs: a ring of red rubber, a wall of cracked mirrors, a crowd of about eleven, and a man in a sequinned suit with a microphone that isn't plugged in."),
  K("Oi oi! Welcome to THE KRUNCH PIT, the only building in Krelford with a fire exit AND a fire. I'm Kev Krunch. I run it. Don't touch the ropes, they're load-bearing."),
  K("Three ways to bleed in here, sunshine. The ENDLESS GAUNTLET: waves of absolute wrong'uns till you drop. Every fifth wave, someone you've already battered comes back for seconds."),
  K("REMATCHES: anything you've beaten out there, you can beat again in here. Turn the Heat up and I pay more. Turn it up to Ring of Fire and I pay for your funeral. Half of it."),
  K("And the TEST RANGE. Every gun in Krelworld, on loan, free. Break one and I break you. Kidding. It's insured. You're not."),
  K("None of it counts, mind. Nothing that happens in here goes in the history books. It goes in your wallet. And on the floor."),
];

/** Walking back in (one at random). */
export const PIT_HELLO: Line[] = [
  K("Back for more? Lovely. The mop's still wet from last time."),
  K("The crowd's in. Well, Dave's in. Dave IS the crowd."),
  K("Step right up! Fight for money, fight for glory, fight because your dad never came to sports day!"),
  K("Ladies, gentlemen and whatever Krezwonk is: THE KRUNCH PIT IS OPEN!"),
  K("No lore in the Pit. Drongus can't touch you down here. He's tried. He's barred."),
  K("Mind the floor, it's mostly teeth."),
];

/** Picking a mode. */
export const PIT_PICK: Record<"gauntlet" | "rematch" | "range", Line[]> = {
  gauntlet: [K("The Gauntlet! Waves till you pop. Pause and walk out whenever you like, you keep what you've made. Most don't walk out. Most pop.")],
  rematch: [K("Rematch, is it? Same fight, more spice. Nothing you do in there changes a thing out here. Very healthy. Very therapeutic.")],
  range: [K("Test range. Infinite ammo, can't die, don't get paid. Like a gap year.")],
};

/** The results cards. */
export const PIT_DEATH: Line[] = [
  K("And they're DOWN! Somebody get a bucket. Two buckets."),
  K("Oof. Closed casket. Open bar, though."),
  K("You fought like a lion. A really old lion. With a limp."),
  K("I've seen better footwork on a fucking shopping trolley."),
  K("Don't worry, the coins you made are still yours. The teeth are mine now."),
  K("That was absolutely embarrassing, you useless cunt. Same time tomorrow?"),
];
export const PIT_WIN: Line[] = [
  K("WINNER! Pay the lad! Not too much!"),
  K("Get in! That's going on the wall. Next to the stain."),
  K("Lovely stuff. The crowd's going wild. Dave's clapping. Dave never claps."),
];
export const PIT_RECORD: Line[] = [K("NEW RECORD! I'm putting your name on the board. In biro. Don't get excited.")];
export const PIT_QUIT: Line[] = [K("Walked out with the money? Smartest thing anyone's ever done in here.")];
export const PIT_RANGE_DONE: Line[] = [K("All the loaners back on the rack? I'm counting them. I can count to nine.")];

/** The death card's headline (not spoken). */
export const PIT_DEATH_TITLES = ["KRUNCHED.", "THAT'S A TAP-OUT", "STRETCHERED OFF", "BITS EVERYWHERE", "SPONSORED BY CRUTCHES", "CARRIED OUT FEET FIRST", "THE PIT WINS AGAIN"];
/** ...and its small print (not spoken). */
export const PIT_DEATH_SMALL = [
  "Cause of death: enthusiasm.",
  "The crowd has already started a whip-round. It's for Kev.",
  "Your next of kin have been informed. They said 'who?'.",
  "Somebody's selling your trainers in the car park.",
  "The ref counted to ten, then to eleven, then went for a pint.",
  "Medical report: 'all of it, mate'.",
];

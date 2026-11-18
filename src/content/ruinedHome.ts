import { dir, say } from "./dsl";
import type { Line } from "../data/types";

/**
 * Chapter 7, after Krelford is bombed: what's left of your house. Everything still works amongst the rubble,
 * there's a pussy juice stash in the wreckage, and Tracy (who's been living under your stairs since the bombing,
 * with a shopping trolley full of supplies) is up for a squeeze. Used by HomeScene's ruined variant (scenes/home/ruinedHome.ts).
 */

/** The squeezer sheltering in the wreckage. */
export const RUIN_WOMAN = "TRACY";

/** Walking in for the first time. */
export const RUIN_ARRIVE: Line[] = [
  dir("What's left of your house. Half the roof is in the front garden and the other half is in the living room. You can see the sky. The sky is on fire."),
  dir("But the telly's still plugged in. The bed's still a bed. The gun rack's still on the wall. And there's a crate of pussy juice under that beam that the Krunch Protocol somehow missed."),
  say(RUIN_WOMAN, "Oh thank God, it's you. Don't shoot. I've been under your stairs since the bombs. I brought my trolley."),
];

/** Tracy, when you walk up to her. */
export const RUIN_WOMAN_HI: Line[] = [
  "Alright, love. Still alive, then. Before you go up that hill: this might be the last squeeze in Krelford.",
  "Everyone I know is ash, love. Golden juice, for the road. It's what they'd have wanted.",
  "I've got tinned peaches, three bin bags and a pulse. And I'm still up for it.",
].map((t) => say(RUIN_WOMAN, t));

/** The pussy juice stash. */
export const RUIN_STASH_FILL = "You dig through the plaster to the crate and fill every bottle on your belt. Warm. Gritty. Still pussy juice.";
export const RUIN_STASH_FULL = "Your bottles are full already. The crate's still half full. Somebody up there loves you. Not Drongus.";

/** The interactables, after the bombs. */
export const RUIN_TV = "The telly's cracked down the middle and half buried in plaster. It still works. Somehow. It's showing Krunche News.";
export const RUIN_WINDOW = "There's no window any more. There's no wall round where the window was. Krelford is on fire in every direction, and at the top of the hill Da Drongus Dungeon's door is open, glowing pink.";
export const RUIN_SLEEP = "You lie down on the bed. It's mostly brick dust now. It's still the comfiest thing in Krelford.";

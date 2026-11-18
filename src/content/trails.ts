import type { Line } from "../data/types";
import { dir, ping, say } from "./dsl";

/**
 * Explore-before-the-dungeon trails (the same idea as the Cronster's cuddle tokens in Chapter 3, generalised):
 * a short hunt of glowing clues, the first one out in Krelford, the rest INSIDE buildings you can walk round.
 * The chapter's dungeon door stays locked until the trail's done (src/game/systems/trails.ts has the logic).
 */

/** Where a clue lies: out in Krelford, or inside one of the rooms you can walk into. */
export type TrailPlace = "FIELD" | "HOME" | "PUB" | "CLUB" | "KREDDLE" | "POLSON";

export interface TrailClue {
  /** Short name, for the toast and the prompt. */
  name: string;
  where: TrailPlace;
  /** Hub coordinates for FIELD; room coordinates indoors (Kreddle: world coordinates on the Strip). */
  x: number;
  y: number;
  /** Roughly where it is, for the objective text ("one's ..."). */
  hint: string;
  /** For the outdoor clue: the building the objective arrow points at. */
  near?: string;
  /** What you find. */
  lines: Line[];
}

export interface TrailDef {
  id: string;
  chapter: number;
  /** Toast title. */
  title: string;
  /** The count word: "RECEIPTS 2/5". */
  label: string;
  /** One of them, for prompts: "Pick up: Papa Gino's receipt". */
  item: string;
  /** The prop drawn for each clue (existing art), and its glow colour. */
  tex: string[];
  tint: number;
  /** The trail starts once this flag is set (the beat just before the dungeon). */
  startFlag: string;
  /** Played in Krelford the first time you're out with the trail open. */
  intro: Line[];
  /** Played once the outdoor clue's found: the rest are indoors. */
  indoors: Line[];
  /** Played when the last clue's found: the door opens. */
  done: Line[];
  clues: TrailClue[];
}

// ---------------------------------------------------------------- CHAPTER 4: THE GOLDEN WRAPPERS

const CH4: TrailDef = {
  id: "ch4_wrappers",
  chapter: 4,
  title: "THE GOLDEN WRAPPERS",
  label: "WRAPPERS",
  item: "golden Crobley wrapper",
  tex: ["p_crobley", "hd_candy"],
  tint: 0xffd23f,
  startFlag: "vig_crobley_presser",
  intro: [
    dir("Out on the street, every telly in every window is playing the Crobley advert. It has a new ending."),
    dir("Reinhardt, grinning, holding up a gold wrapper: 'FIVE GOLDEN CROBLEYS HIDDEN ROUND KRELFORD! FIND ALL FIVE FOR A PERSONAL TOUR OF THE FACTORY! NIBBLE ON A CROBLEY!' Then a scream. Then the jingle."),
    ping("KREBLIS", "Breaking news… the factory gate only opens with five golden wrappers 👍 I tried. It's electric"),
    ping("KREZMAR", "A promotional scavenger hunt. During a murder investigation. The share price is going to love this."),
    ping("SCROMBUS", "Five wrappers. Then we're in. Then we kill him."),
    dir("NEW OBJECTIVE: find Reinhardt's five golden Crobley wrappers. The first one glints outside the Constabulary. The factory gate stays shut until you've got all five."),
  ],
  indoors: [
    dir("Printed inside the wrapper, in very small writing: 'THE OTHER FOUR ARE INDOORS. I'VE BEEN IN ALL YOUR LITTLE HOUSES. NIBBLE ON A CROBLEY ;)'"),
    dir("Four more, any order: Polson Towers, the Krezz Arms, Kreddle, and… your house. Walk in and look round: they glint."),
  ],
  done: [
    dir("Five golden wrappers. Hold them up to the light together and they make a tiny map: the factory gate, a side door, and a cartoon Reinhardt waving with a knife."),
    ping("KREBLIS", "Breaking news… we have a tour booked 👍"),
    ping("SCROMBUS", "It's not a tour. Get in there."),
    dir("THE CROBLEY FACTORY GATE IS OPEN. East side of town."),
  ],
  clues: [
    {
      name: "wrapper outside the Constabulary",
      where: "FIELD",
      x: 1830,
      y: 1540,
      near: "POLICE",
      hint: "on the road outside the Constabulary",
      lines: [
        dir("A golden Crobley wrapper, glued to the pavement with what you hope is toffee. Inside: 'CONGRATULATIONS! 1 OF 5. NIBBLE ON A CROBLEY.'"),
        dir("There's a tiny drawing of Reinhardt on it. He's winking. You fold it so he stops."),
      ],
    },
    {
      name: "wrapper down Polson's sofa bed",
      where: "POLSON",
      x: 470,
      y: 300,
      hint: "Polson Towers (down the sofa bed)",
      lines: [
        dir("Down the side of Polson's sofa bed: one golden Crobley wrapper. And forty normal ones."),
        say("POLSON", "I've been doing research!! For you!! I've nibbled on about forty 😅"),
        say("POLSON", "Is that bad for the gym? Don't answer that"),
      ],
    },
    {
      name: "wrapper on the pumps",
      where: "PUB",
      x: 700,
      y: 470,
      hint: "the Krezz Arms (behind the pumps)",
      lines: [
        dir("Stuck to the Pussy Juice pump with chewed Crobley: a golden wrapper. Someone's written 'RIGGED' on it in biro."),
        dir("The barman says a man in a top hat came in, didn't buy a drink, laughed for nine minutes and left. He'd like it known the man was barred on the way out."),
      ],
    },
    {
      name: "wrapper by the Klerble Fountain",
      where: "KREDDLE",
      x: 1690,
      y: 600,
      hint: "Kreddle, over the bridge (by the Klerble Fountain)",
      lines: [
        dir("On the rim of the Klerble Fountain, under a hundred wet Krezzcoins: a golden Crobley wrapper. You fish it out. You are now wet to the elbow."),
        dir("A Kreddler tells you a man in a top hat bought the fountain last week for the publicity, then sold it back at a loss. 'Classic Reinhardt.'"),
      ],
    },
    {
      name: "wrapper behind your telly",
      where: "HOME",
      x: 230,
      y: 470,
      hint: "your house (behind the telly)",
      lines: [
        dir("Behind your telly, tucked in the back where the dust lives: a golden Crobley wrapper. Nobody has a key to your house. Reinhardt Crobley has a key to your house."),
        dir("On the back: 'Lovely home. Love what you've done with the bed. See you at the factory ;)'"),
      ],
    },
  ],
};

export const TRAILS: TrailDef[] = [CH4];

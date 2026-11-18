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

// ---------------------------------------------------------------- CHAPTER 2: WHERE'S POLSON?

const CH2: TrailDef = {
  id: "ch2_receipts",
  chapter: 2,
  title: "WHERE'S POLSON?",
  label: "RECEIPTS",
  item: "Papa Gino's receipt",
  tex: ["ddk_paper", "ddk_pizza"],
  tint: 0xffc46b,
  startFlag: "fragmar_briefed",
  intro: [
    dir("Outside the War Room. You turn round to say 'right then, Polson Towers'. Polson is not there. Luke's sofa has a Polson-shaped dent in it and nothing else."),
    ping("CRONGUS", "Where's Polson"),
    ping("CRONGUS", "I went to get him a biscuit. He's gone. The biscuit's also gone"),
    ping("POLSON", "Hey dude!! Can't say where I am bc Eden reads my phone 😅"),
    ping("POLSON", "I've left you a trail!! Like Hansel and Gretel. But Papa Gino's receipts"),
    ping("SCROMBUS", "Polson. Just tell us where you are."),
    ping("POLSON", "That's fair.. but she's literally reading this rn 😬"),
    ping("KREZWONK", "Follow the receipts. The first one's on the road outside the War Room. I can see it from here. It's glowing."),
    dir("NEW OBJECTIVE: follow Polson's trail of Papa Gino's receipts (5). Polson Towers stays locked until you know where he's holed up."),
  ],
  indoors: [
    dir("On the back of the receipt, in biro: a list. 'PLACES I HAVE BEEN TODAY: your house. The Krezz Arms. The Wonky Pole (for the protein bars). Kreddle (briefly).'"),
    dir("He's left a receipt in every one. Four more, all indoors, any order. Walk in and have a look round: they glow."),
  ],
  done: [
    dir("Five receipts. You lay them out in a row. Read together, the bits scribbled on the backs make one sentence."),
    dir("'DELIVER TO: POLSON TOWERS. THE AIRING CUPBOARD. KNOCK THREE TIMES. DO NOT GIVE TO EDEN. DO NOT GIVE TO THE CYST.'"),
    ping("POLSON", "Ok I'm home!! In the airing cupboard. It's warm. The cyst is RIGHT outside 😬"),
    ping("POLSON", "Is now a bad time to say I've left the oven on"),
    ping("KREZWONK", "He walked all the way round Krelford to end up in his own cupboard. The prophecy was right."),
    dir("POLSON TOWERS IS OPEN. Get him out of his own airing cupboard. Kill the cyst."),
  ],
  clues: [
    {
      name: "receipt on the War Room steps",
      where: "FIELD",
      x: 1700,
      y: 590,
      near: "ARCHIVE",
      hint: "on the road outside the War Room (the Archive)",
      lines: [
        dir("A Papa Gino's receipt, folded into a little arrow. 'ONE LARGE MEAT FEAST. EXTRA MEAT. NO VEG. CUSTOMER NOTE: going to my mate's house for a bit 😅'"),
        dir("There's a map on the back. He has drawn your house. He has drawn it as a pizza."),
      ],
    },
    {
      name: "receipt by your front door",
      where: "HOME",
      x: 705,
      y: 528,
      hint: "your house (he's had a nap on your floor)",
      lines: [
        dir("On the floor by your front door, still warm: a receipt and a Polson-shaped dent in the carpet. 'GARLIC BREAD x2. DIPS x6. NOTE: had a little nap at yours. Your floor is better than my bed. My bed has Eden in it'"),
        dir("The carpet smells of garlic and anxiety. You'll be hoovering that. You won't be hoovering that."),
      ],
    },
    {
      name: "receipt under the bar",
      where: "PUB",
      x: 700,
      y: 470,
      hint: "the Krezz Arms (under the bar)",
      lines: [
        dir("Wedged under the bar, between a Fizzy Bongo cap and a tooth: a receipt. 'DOUGH BALLS x12. NOTE: had one pint to calm down. Then a second pint to calm down from the first pint 😅'"),
        dir("On the back: 'Kreblis says hi. Kreblis says it's not his tooth.' It is Kreblis's tooth."),
      ],
    },
    {
      name: "receipt down the red sofa",
      where: "CLUB",
      x: 250,
      y: 400,
      hint: "the Wonky Pole (through the back of the Krezz Arms)",
      lines: [
        dir("Down the side of the red sofa, at Polson height: a receipt and half a protein bar. 'PROTEIN BAR (CHOC FUDGE). NOTE: only here for the protein bars they sell at the bar. Absolutely not for any other reason. Gym soon!!'"),
        dir("Big Derek says he tipped in Papa Gino's vouchers, said 'sorry' to the pole, and left during the second song."),
      ],
    },
    {
      name: "receipt at the Kreddle Exchange",
      where: "KREDDLE",
      x: 470,
      y: 640,
      hint: "Kreddle, over the bridge (outside the Kreddle Exchange)",
      lines: [
        dir("Outside the Kreddle Exchange, in a puddle of neon: a receipt. 'CHICKEN WINGS x20. NOTE: tried to gamble my trust fund to buy the house back off Eden. Mum rang the casino.'"),
        dir("'They gave me the wings for free. Out of pity. Wbu?'"),
      ],
    },
  ],
};

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

export const TRAILS: TrailDef[] = [CH2, CH4];

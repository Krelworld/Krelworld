import type { Line } from "../data/types";
import { dir, say } from "./dsl";

// The ALT build only (src/game/variant.ts): Luke (Lil' Crongus) and Jenko (Flenky) take turns in the Frustration Booth
// where Mikey hangs in the normal build (HubScene "BOOTH", MinigameScene bully). Kept here, as Lines, so the voice
// extractor records them in each lad's own voice.

export interface BoothCast {
  /** Walking into the Booth in town. */
  enter: Line[];
  /** The minigame's opening stage direction. */
  intro: Line;
  /** What he says while you lay into him: the first opens, the last is for when you run out of time. */
  barks: Line[];
  /** Frustration gone. */
  win: Line[];
}

export const BOOTH_ALT: Record<"CRONGUS" | "FLENKY", BoothCast> = {
  CRONGUS: {
    enter: [
      dir("The Booth. Luke is hanging from the ceiling in a punching-bag harness. He has brought his own harness. It's a Lil' one."),
      say("CRONGUS", "Luke here. Go on then. Get it out of your system. Not the face."),
    ],
    intro: dir("The Booth. Luke has been strung up as a heavy bag. He seems fine with it. He is never fine with it."),
    barks: [
      say("CRONGUS", "Luke here. Lil' Luke."),
      say("CRONGUS", "Not the face! I'm Lil'!"),
      say("CRONGUS", "My little arms can't block!"),
      say("CRONGUS", "Is this about the bread and butter pudding?"),
      say("CRONGUS", "I'll make you all a pudding! A nice one!"),
      say("CRONGUS", "OW. Okay that one was fair."),
      say("CRONGUS", "I'm telling Boggor!"),
      say("CRONGUS", "Lmao. Ow."),
      say("CRONGUS", "I'm going to get rinsed in the chat for this, aren't I."),
    ],
    win: [say("CRONGUS", "Fair play. Fair play. Same time next week?"), say("CRONGUS", "Can someone get me down? My arms have gone all Lil'.")],
  },
  FLENKY: {
    enter: [
      dir("The Booth. Jenko is hanging from the ceiling in a punching-bag harness. Someone has written BANNED on it in marker."),
      say("FLENKY", "Jenko here. Go on then. I've been banned from worse."),
    ],
    intro: dir("The Booth. Jenko has been strung up as a heavy bag. He seems fine with it. He is never fine with it."),
    barks: [
      say("FLENKY", "Jenko here. Am I banned?"),
      say("FLENKY", "Is this because my parents are still together?!"),
      say("FLENKY", "I know Brazilian jiu-jitsu! ...I don't."),
      say("FLENKY", "Oh shut it! Wot do u no!"),
      say("FLENKY", "Nine times! That's NINE TIMES!"),
      say("FLENKY", "OW. That was ironic, right? Tell me that was ironic."),
      say("FLENKY", "Ninjas don't even feel pain. OW."),
      say("FLENKY", "I'm appealing this! I'm the Exile Appeals Officer!"),
      say("FLENKY", "Money is no object mate. OW. Lol jk."),
    ],
    win: [say("FLENKY", "Fair play. Fair play. Same time next week?"), say("FLENKY", "Am I still banned though?")],
  },
};

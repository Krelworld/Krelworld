import type { Line, ReactionChoice } from "../data/types";
import { dir, ping, say } from "./dsl";

export const FINAL_PROMPT: Line[] = [
  dir("The boss music stops. The Citadel goes quiet. Drongus is on the floor of the Krezzsplosion article, glowing faintly, panting."),
  say("DRONGUS", "You could at least react to the song, mate."),
  dir("A single Messenger bubble floats down in front of you."),
];

export const ENDINGS: Record<"LIKE" | "LOVE" | "LAUGH" | "SEEN", { title: string; lines: Line[] }> = {
  LIKE: {
    title: "ENDING: 👍 THE CANONICAL THUMB",
    lines: [
      dir("👍"),
      dir("Your thumb lands on the song with a soft, satisfying 'pop'."),
      dir("Instantly, Krelworld restores itself. The sky reloads. The word 'TOWN' climbs back onto the Town Hall sign. The pigeon is relieved. Every vending machine in Krelford plays a little psychedelic jingle in unison."),
      say("DRONGUS", "..."),
      say("DRONGUS", "Thanks."),
      dir("He means it. It's very quiet. Several seconds of peace."),
      dir("Several more."),
      dir("Then: a notification."),
      ping("DRONGUS", "New one lads"),
      ping("DRONGUS", "🎵 THE KREZZING HOUR PART II (Extended Krezzmas Mix)"),
      dir("Seen by everyone."),
      dir("Nobody reacts."),
    ],
  },
  LOVE: {
    title: "ENDING: ❤️ SUSPICIOUSLY SINCERE",
    lines: [
      dir("❤️"),
      dir("The heart floats up and settles on the song."),
      say("DRONGUS", "...is this sarcasm."),
      say("DRONGUS", "Is this a bit."),
      say("DRONGUS", "Are you taking the piss."),
      dir("You are not taking the piss. You hold eye contact. It is the most uncomfortable moment in Krelworld's history, including the Krezzsplosion."),
      say("DRONGUS", "Right. Okay. Well. Thanks. I suppose. That's. Hm."),
      dir("Krelworld restores itself, slightly awkwardly, like a man accepting a compliment. The Tap gives a little embarrassed gurgle."),
      ping("DRONGUS", "I'm putting that on the wiki btw"),
      ping("DRONGUS", "'The day someone loved the song'"),
      ping("DRONGUS", "Nobody's going to read it"),
    ],
  },
  LAUGH: {
    title: "ENDING: 😂 THE CONTENT LANDED",
    lines: [
      dir("😂"),
      dir("The laughing face bursts onto the song like a firework."),
      say("DRONGUS", "..."),
      say("DRONGUS", "You laughed."),
      say("DRONGUS", "YOU LAUGHED."),
      say("DRONGUS", "It's FUNNY. I KNEW it was funny. I TOLD my BROTHER it was funny."),
      dir("Drongus leaps to his feet. The Citadel erupts in confetti made of wiki citations. Krelworld doesn't just restore itself; it gets a little bit bigger. A new district appears overnight. It's called Laughton."),
      say("DRONGUS", "That's the spirit."),
      ping("DRONGUS", "Right I'm doing a sequel"),
      ping("DRONGUS", "And a musical"),
      ping("DRONGUS", "And a wiki page about the musical"),
      ping("DRONGUS", "Nobody stop me"),
      dir("Nobody stops him. Nobody reacts to any of them either."),
    ],
  },
  SEEN: {
    title: "ENDING: SEEN BY 10",
    lines: [
      dir("You look at the song."),
      dir("You don't press anything."),
      dir("Seen by 10."),
      say("DRONGUS", "..."),
      say("DRONGUS", "Wow."),
      say("DRONGUS", "Even now."),
      say("DRONGUS", "Even after all that."),
      say("DRONGUS", "Whatever. I don't care. No big deal. What the fuck ever."),
      dir("He very obviously cares. He's grinning."),
      ping("DRONGUS", "Putting THIS on the wiki"),
    ],
  },
};

export const CREDITS: string[] = [
  "KRELWORLD: WONK 'TIL YOU KREZ",
  "",
  "A game made out of a group chat that accidentally became a country.",
  "",
  "Lore by the Krezzing Krew, 2022–2025",
  "Original transcripts: FGM ULTRA and KRELWORLD KREW",
  "",
  "Drongus B. Drippin' as himself",
  "Proctus Krelmor as everyone else",
  "",
  "No Krezbians were harmed. There are 80 million of them. Purple. Cannons for arms.",
  "Ministry of Defence: vacant",
  "",
  "Thanks for playing.",
  "Please react.",
];

export const SEQUEL_CARD = "SEE YOU IN KRELWORLD 64";

export function endingKeyFor(choice: ReactionChoice): keyof typeof ENDINGS {
  if (choice === "LIKE" || choice === "LOVE" || choice === "LAUGH") return choice;
  return "SEEN";
}

import type { Line } from "../../data/types";
import { bMax, bMod, dir, ping, say } from "../dsl";

// CHAPTER 7, after Drongus's lair: Krelford, the morning after the Krunch Protocol.
// The joke: the lads think they did all this on a night out. Nobody says "missiles". Nobody says "bombed".

export const AFTER_WAKE: Line[] = [
  dir("Krelford. Night. Rain. Thunder. Smoke everywhere, and embers drifting past like snow. Where the Town Hall used to be, there's a big pile of something."),
  dir("The pile moves."),
];

export const AFTER_HANGOVER: Line[] = [
  say("KREZMAR", "…ughhhhhh."),
  say("MIKEY", "Ugh. Lads.. My head."),
  bMod(say("KREBLIS", "Breaking news… I'm never drinking or doing gear ever again 👍")),
  say("SCROMBUS", "What happened last night?"),
  say("KREBON", "We went on a mad one. It got a little mental."),
  bMax(say("GRONNY", "Me no remember. Me remember disco. Then ceiling.")),
  bMax(say("CRONGUS", "Has someone moved the Town Hall? It's… lower.")),
  bMax(say("KREZWONK", "I foresaw this hangover. I did not foresee its scale.")),
  say("KREZMAR", "Look at the state of the place. We really went for it."),
  bMod(say("MIKEY", "Someone's set fire to Krelburger. Classic us.")),
  bMax(say("KREBON", "Somebody's going to have to tidy all this up. Such as a woman.")),
  bMax(say("KREBLIS", "Mmm… smoke…")),
  { s: "YOU", t: "Honestly lads. Best night ever. I think.", tag: "new" },
];

export const AFTER_LEAK: Line[] = [
  dir("Somewhere in the rubble, a phone buzzes. Then another. Then all of them. At once."),
  ping("DRONGUS", "DA DAY OF JUDGEMENT"),
  ping("DRONGUS", "The chat leaks tonight 🙂"),
  ping("DRONGUS", "All of it. Every message. Every song you didn't react to."),
  dir("A long, terrible silence."),
];

/** Played over the shrieking. */
export const AFTER_SHRIEK: Line[] = [
  say("MIKEY", "AAAAAAIIIIIEEEEEEE!!!"),
  say("KREZMAR", "EEEEEEEEEEEEEEEEE!!!"),
  say("KREZMAR", "My job. MY JOB. If my boss sees the chat I'm finished."),
  say("SCROMBUS", "The whole town's going to see it! The whole town is going to JUDGE us!"),
  bMod(say("CRONGUS", "They'll see the pudding stuff. Everyone in Krelford will know.")),
  bMod(say("FLENKY", "I'll never work in this town again.")),
  bMax(say("GRONNY", "Me job! Me… what is me job?")),
  bMod(say("KREBLIS", "Breaking news… we are fucked 👍")),
  bMod(say("KREBON", "We could turn the internet off.")),
];

export const AFTER_CRYSTAL: Line[] = [
  dir("Then: a glow, from somewhere in the rubble. Pink. Insistent."),
  say("KREZWONK", "Lads. Look."),
  dir("It's a cum crystal. The sixth one. It's just… there. Nobody knows where it came from. Nobody asks."),
  say("MIKEY", "Six. That's six. When did we get six?"),
  say("KREBON", "We must have got it last night."),
  bMod(say("SCROMBUS", "Absolute legends. Even blackout drunk we're on mission.")),
  dir("At the top of town, through the smoke, the six slots on Da Drongus Dungeon light up one by one. The gates grind open."),
  say("KREZMAR", "Right. It's game on. We stop the leak."),
  { s: "YOU", t: "Da Drongus Dungeon. Let's go.", tag: "new" },
  dir("CUM CRYSTALS: 6/6. DA DRONGUS DUNGEON IS OPEN."),
];

/** At the gates of Da Drongus Dungeon: the lads go in first. */
export const CITADEL_ENTRY: Line[] = [
  dir("The gates of Da Drongus Dungeon. Up close it's bigger. And it's humming."),
  say("KREZMAR", "Right. Everyone in. Stop the leak. Nobody touch anything."),
  say("MIKEY", "FGM ULTRA. Final op. Go go go."),
  say("SCROMBUS", "We'll scout ahead. Catch us up."),
  dir("And with that, they're gone. You're last. You're always last."),
];

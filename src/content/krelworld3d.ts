import type { Line } from "../data/types";
import { say } from "./dsl";

// THE 3D EPILOGUE (after the wormhole, before the credits): the lads land in Krelworld, rendered in full
// PS2-era 3D. It was real all along. Played by src/game/scenes/ending/krelworld3d.ts as timed subtitles;
// the text lives here so the voice extractor finds it.

export const K3_LAND: Line[] = [
  say("KREBLIS", "Breaking news… where the fuck are we 👍", { mood: "dazed" }),
  say("KREZWONK", "My legs have gone polygonal.", { mood: "dazed" }),
];

export const K3_REAL: Line[] = [
  say("FLENKY", "IT WAS REAL! IT WAS REAL THE WHOLE TIME!", { mood: "shouting, excited" }),
  say("SCROMBUS", "The first plot twist was fake!! It was the 'real universe' that was the illusion all along!! KRELWORLD is the actual real universe!", { mood: "shouting, excited" }),
  say("DRONGUS", "I didn't make a game. I made a WORLD."),
  say("POLSON", "Yeeegh!! I'm alive?! Respawned 😅 Wbu?", { mood: "excited" }),
  say("GRONNY", "Me home."),
];

export const K3_BENN: Line[] = [
  say("KREBON", "Me want real pussy juice!!", { mood: "shouting, excited" }),
  say("KREBON", "Mmm… lovely yet yummy pussy juice.", { mood: "gargling, happy" }),
];

export const K3_MIKEY: Line[] = [say("MIKEY", "Yee yee YEEE! You FUCKING CUNTSS!", { mood: "shouting, crazy" })];
export const K3_SANMIK: Line[] = [say("SANMIK", "YEEEEE! SanMik in tha building! Brap brap!", { mood: "shouting, crazy" })];

export const K3_LUKE: Line[] = [say("CRONGUS", "The bread and butter house is real!! I need it!", { mood: "excited, overjoyed" })];

/** Everyone left dancing chants it together (played on top of each other). */
export const K3_CHANT: Line[] = (["SCROMBUS", "FLENKY", "KREBLIS", "KREZWONK", "POLSON"] as const).map((id) => say(id, "Krel world! Do the krel dance!", { mood: "chanting" }));

export const K3_KREZMAR: Line[] = [
  say("KREZMAR", "Right you fucking cunts.", { mood: "menacing, slow" }),
  say("KREZMAR", "It's wonking time.", { mood: "menacing, whispers" }),
];

/** The card before the credits. */
export const K3_SEQUEL = "THE LADS WILL RETURN..\nIN 'KRELWORLD 64'";

/** Polson finds a Krelburger. Krezwonk regrets standing next to him. */
export const K3_POLSON: Line[] = [
  say("POLSON", "Mm… Krelburger.", { mood: "happy, hungry" }),
  say("POLSON", "Mmm… gorgeous.", { mood: "mouth full, satisfied" }),
  say("KREZWONK", "Fuck me, that's rancid.", { mood: "disgusted, gagging" }),
  say("POLSON", "Well, you know where to come if you need any paint stripping!", { mood: "smug" }),
];

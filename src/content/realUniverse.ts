import type { Line } from "../data/types";
import { dir, say } from "./dsl";

// THE REAL UNIVERSE: after the epilogue, before the credits. The camera pulls out of the screen: you've been
// sat at your PC playing Harry's game the whole time. Then the girlfriend (offscreen, never seen) finds out.
// She uses your real first name (the lads said that's fine), never the Krelworld nickname.

/** Your first name, the way she screams it. */
export const GIVEN_NAME: Record<string, string> = {
  FLENKY: "JAMES",
  KREZMAR: "CHARLIE",
  KREBLIS: "DAVID",
  KREZWONK: "MART",
  SCROMBUS: "BEN",
  KREBON: "BENN",
  CRONGUS: "LUKE",
  GRONNY: "RORY",
  MIKEY: "MIKEY",
};

const named = (t: (n: string) => string) => Object.fromEntries(Object.entries(GIVEN_NAME).map(([id, n]) => [id, t(n)]));

export const RU_WOW: Line[] = [say("YOU", "Wow. Drongus really made a great game.", { mood: "impressed" })];

/** The card that slams onto the screen with the sting. */
export const RU_TWIST = `PLOT TWIST: KRELWORLD WAS NEVER REAL.\nYOU HAVE BEEN IN THE "REAL UNIVERSE"\nTHIS ENTIRE TIME`;

export const RU_GF_1: Line[] = [
  say("GIRLFRIEND", "OI!!!", { variants: named((n) => `${n}!!!`), mood: "screaming" }),
  say("GIRLFRIEND", "WHAT HAVE YOU BEEN FUCKING DOING?! FUCKING GET DOWN HERE!", { mood: "screaming, furious" }),
  say("GIRLFRIEND", "IF I FIND OUT YOU'VE BEEN ON THE FUCKING GROUP CHAT WITH THAT CUNT HARRY AGAIN I'LL FUCKING LOSE IT!!", { mood: "screaming, furious" }),
];

export const RU_MEEK: Line[] = [
  say("YOU", "S-sorry babe… I'll be done soon. Promise.", { mood: "nervous, whispers" }),
  say("YOU", "I just need to react to Harry's new game…", { mood: "nervous" }),
];

export const RU_GF_2: Line[] = [
  say("GIRLFRIEND", "KRELWORLD ISN'T FUCKING REAL! IT'S NEVER BEEN REAL!", { mood: "screaming, furious" }),
  say("GIRLFRIEND", "WHAT'S REAL IS ME NEEDING MONEY TO GO CLOTHES SHOPPING!", { mood: "screaming" }),
  say("GIRLFRIEND", "I HATE YOU!!!", { mood: "screaming, furious" }),
];

export const RU_THROW: Line[] = [say("GIRLFRIEND", "AAAAAAAAAAAHHHHHHHHHHHHHHHHHHH!!!", { mood: "screaming" })];

export const RU_DESPAIR: Line[] = [
  dir("The plates stop. Somewhere downstairs, a door slams. Then another door. Then the first door again."),
  say("YOU", "I hate my life…", { mood: "sad, crying" }),
  say("YOU", "I wish I was more like Harry.", { mood: "sad, crying" }),
  say("YOU", "I wish I could escape to the 'computer universe'…", { mood: "sad, crying" }),
  say("YOU", "Why can't Krelworld be real…", { mood: "sad, crying" }),
  say("YOU", "I have purpose there… I matter there…", { mood: "sad, crying" }),
  say("YOU", "In the 'real universe'… I'm a nobody…", { mood: "crying, sobbing" }),
];

export const RU_SMASH: Line[] = [say("YOU", "ARGHHH!! FUCK!! FUCK!! FUCK!!", { mood: "screaming, angry" })];

export const RU_PORTAL: Line[] = [dir("The screen doesn't break. It opens.")];

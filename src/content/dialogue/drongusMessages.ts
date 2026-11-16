import type { Cond } from "../../data/types";

// Drongus is never in the room. He is always in your notifications.
// Each sequence fires once per playthrough (unless `repeat`), as Messenger toasts. Chapter 1's first ones wait till
// you come out of the first briefing (the Emergency Reaction Session), not the moment you leave the house.

export interface DrongusSequence {
  id: string;
  trigger: string;
  cond?: Cond;
  repeat?: boolean;
  messages: string[];
}

export const DRONGUS_SEQUENCES: DrongusSequence[] = [
  { id: "d_ngplus", trigger: "hub", cond: { chapter: 1, ngPlus: true, flag: "met_emergency" }, messages: ["New one lads", "🎵 THE KREZZING HOUR PART II (Extended Krezzmas Mix)"] },
  { id: "d_hub1", trigger: "hub", cond: { chapter: 1, ngPlus: false, flag: "met_emergency" }, messages: ["Hello ?", "Did everyone see the song ?", "It's whatever. Don't even give a shit at this point"] },
  { id: "d_hub2", trigger: "hub", cond: { chapter: 2 }, messages: ["I've definitely had the last laugh about all the Polson stuff! I'm sure you all agree!", "He's probably there obsessing over me whereas I am here merely laughing"] },
];

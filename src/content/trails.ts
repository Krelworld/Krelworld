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

// (both chapter trails were taken out: overkill. The system stays, empty, in case one comes back.)
export const TRAILS: TrailDef[] = [];

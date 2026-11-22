/**
 * Banter level: how much the lads chat in briefings and debriefings (meetings, chapter intros and outros, the
 * morning after). No Phaser in here (it's unit-tested).
 *
 * Nothing is ever reworded or added: lines in those scenes carry a `banter` tag (the lowest level they still play at)
 * and the dialogue box just skips the ones the current level leaves out. Untagged lines always play, and a line that
 * does something (a flag, a choice, a reaction, the telly, a Kreltality...) always plays whatever it's tagged.
 * TV, the news, adverts and archive playback are never tagged. Switch in the pause menu: it kicks in from the next scene.
 * Voices are keyed by speaker + text (audio/voiceKey.ts), never by position, so a skipped line can't shift them.
 */
import type { BanterLevel, Line } from "../../data/types";

export interface BanterDef {
  id: BanterLevel;
  name: string;
  /** One plain line: what it does. */
  blurb: string;
  color: number;
}

export const BANTER_LEVELS: readonly BanterDef[] = [
  { id: "max", name: "MAX BANTER", blurb: "Everything. Every in-joke, every reference, every tangent, every 'Breaking news…'. The full Krelworld.", color: 0xff6fa8 },
  { id: "moderate", name: "MODERATE BANTER", blurb: "A lighter trim: some of the tangents and back-and-forth go, the best bits stay.", color: 0xffd23f },
  { id: "exposition", name: "EXPOSITION", blurb: "Mostly the plot beats in briefings and debriefings. Some jokes stay; most of the in-jokes and repetition go.", color: 0x67e8f9 },
];

export const DEFAULT_BANTER: BanterLevel = "max";
export const BANTER_NOTE = "Only briefings and debriefings change. TV, the news and everything else are untouched.";

const RANK: Record<BanterLevel, number> = { exposition: 0, moderate: 1, max: 2 };

export function clampBanter(v: unknown, dflt: BanterLevel = DEFAULT_BANTER): BanterLevel {
  return v === "max" || v === "moderate" || v === "exposition" ? v : dflt;
}

export function banterDef(level: unknown): BanterDef {
  const id = clampBanter(level);
  return BANTER_LEVELS.find((b) => b.id === id)!;
}

export function banterLabel(level: unknown): string {
  return banterDef(level).name;
}

/** A line that does something besides being read: these always play, tagged or not. */
export function lineHasEffect(l: Line): boolean {
  return !!(l.set || l.choice || l.react || l.tv || l.rise || l.krel);
}

/** Does this line play at this banter level? */
export function banterKeeps(l: Line, level: BanterLevel): boolean {
  if (!l.banter || lineHasEffect(l)) return true;
  return RANK[level] >= RANK[l.banter];
}

/** The script as played at this level: the same Line objects, in the same order, minus the ones left out. */
export function filterBanter(lines: readonly Line[], level: BanterLevel): Line[] {
  return lines.filter((l) => banterKeeps(l, level));
}

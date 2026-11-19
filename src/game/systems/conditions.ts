import type { Cond, GameState, PlayableId } from "../../data/types";
import { isAlt } from "../variant";

const asList = (p: PlayableId | PlayableId[]) => (Array.isArray(p) ? p : [p]);

export function evalCond(c: Cond | undefined, s: GameState): boolean {
  if (!c) return true;
  if (c.flag !== undefined && !s.flags[c.flag]) return false;
  if (c.flagEq !== undefined && s.flags[c.flagEq[0]] !== c.flagEq[1]) return false;
  if (c.notFlag !== undefined && s.flags[c.notFlag]) return false;
  if (c.chapter !== undefined && s.chapter !== c.chapter) return false;
  if (c.chapterAtLeast !== undefined && s.chapter < c.chapterAtLeast) return false;
  if (c.chapterAtMost !== undefined && s.chapter > c.chapterAtMost) return false;
  if (c.player !== undefined && !asList(c.player).includes(s.player)) return false;
  if (c.notPlayer !== undefined && asList(c.notPlayer).includes(s.player)) return false;
  if (c.revision !== undefined && !s.revisions.includes(c.revision)) return false;
  if (c.notRevision !== undefined && s.revisions.includes(c.notRevision)) return false;
  if (c.intoxAtLeast !== undefined && s.intoxication < c.intoxAtLeast) return false;
  if (c.intoxBelow !== undefined && s.intoxication >= c.intoxBelow) return false;
  if (c.resentmentAtLeast !== undefined && s.drongusResentment < c.resentmentAtLeast) return false;
  if (c.ngPlus !== undefined && (s.ngPlus > 0) !== c.ngPlus) return false;
  if (c.alt !== undefined && isAlt() !== c.alt) return false;
  if (c.any !== undefined && !c.any.some((x) => evalCond(x, s))) return false;
  if (c.not !== undefined && evalCond(c.not, s)) return false;
  return true;
}

/** Pick a random element among those whose condition holds. */
export function pickWhere<T extends { cond?: Cond }>(items: T[], s: GameState, rnd: () => number = Math.random): T | undefined {
  const ok = items.filter((i) => evalCond(i.cond, s));
  if (!ok.length) return undefined;
  return ok[Math.floor(rnd() * ok.length)];
}

/**
 * A line's text for this player in this build: `variants[player]` (in the ALT build `altVariants[player]` first), else
 * in the ALT build `alt`, else `t`. Anything shaped like a Line will do (bubbles, barks).
 */
export function lineText(l: { t: string; alt?: string; variants?: Partial<Record<PlayableId, string>>; altVariants?: Partial<Record<PlayableId, string>> }, player: PlayableId, base = l.t): string {
  const a = isAlt();
  if (a && l.altVariants?.[player] !== undefined) return l.altVariants[player] as string;
  if (l.variants?.[player] !== undefined) return l.variants[player] as string;
  if (a && l.alt !== undefined) return l.alt;
  return base;
}

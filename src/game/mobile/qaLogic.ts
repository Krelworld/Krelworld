// PHONE MODE, stage 4: the pure rules of the phone QA's fixes (posse.ts, qaFixes.ts), unit-tested in node.

/** The HUD's chip line in town ("⚡ GOLDEN JUICE (T to transform)"): only that value is reworded (s4-01 M1). */
export const HUD_CHIP_TEXTS: RegExp[] = [/\(T to transform\)/];

export type PosseMove = "shove" | "punch" | "kick";
export const POSSE_MOVES: readonly PosseMove[] = ["shove", "punch", "kick"];

/** Which move the posse fight is asking for right now (null between prompts). */
export function posseWanted(b: { prompt?: unknown; promptUntil?: unknown } | null | undefined): PosseMove | null {
  if (!b || !b.promptUntil) return null;
  return POSSE_MOVES.includes(b.prompt as PosseMove) ? (b.prompt as PosseMove) : null;
}

/** A "ready" card takes no tap for this long after it shows (the last conversation tap must not start the game). */
export const READY_ARM_MS = 650;

/** At most this many toasts at once on a phone (the oldest goes early): the column must not eat the picture (m1). */
export const TOAST_MAX = 2;

/** The town's camera may run this far (game px) past the map's edge on the buttons' side, and past the bottom (M2). */
export const TOWN_CAM_PAD = Object.freeze({ x: 240, y: 130 });

/** Two rectangles overlap (each grown by `grow` px). */
export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, grow = 0): boolean {
  return a.x - grow < b.x + b.w && b.x - grow < a.x + a.w && a.y - grow < b.y + b.h && b.y - grow < a.y + a.h;
}

/**
 * Whack-a-Drongus's rules line ("HIGH SCORE: 0 · 30 SECONDS · 1 🎟 KROKEN PER 200 POINTS (max 25) · NEW HIGH SCORE +3 🎟
 * · 1000+: 500 KREZZCOIN") as two even lines, split before "NEW HIGH SCORE" (the same words); null if it isn't that line.
 */
export function splitWhackRules(text: string): string | null {
  if (!/^HIGH SCORE: /.test(text) || text.includes("\n")) return null;
  const i = text.indexOf(" · NEW HIGH SCORE");
  if (i < 0) return null;
  return `${text.slice(0, i)}\n${text.slice(i + 3)}`;
}

import type { GameState } from "../../data/types";
import { CHARACTERS } from "../../data/characters";
import { CHAPTERS } from "../../content/chapters/chapters";
import { clampDifficulty, MAX_DIFFICULTY } from "./difficulty";

/**
 * Save slots: one AUTO slot (every G.save() writes it, as the single save always did) plus three manual slots the
 * player saves to from the pause menu. The AUTO slot keeps the old single-save key, so an existing save simply *is*
 * the AUTO slot; on first run with slots it's also copied into SLOT 1, so starting a NEW GAME can't lose it.
 * Settings / NG+ unlocks / the carried loadout (MetaState) stay global, not per slot.
 */
export type SlotId = "auto" | 1 | 2 | 3;
export const MANUAL_SLOTS = [1, 2, 3] as const;
export const SLOT_IDS: SlotId[] = ["auto", 1, 2, 3];

/** The old single-save key: now the AUTO slot. */
export const AUTO_KEY = "krelworld.save";
/** Set once the old single save has been copied into SLOT 1. */
export const SLOTS_MIGRATED_KEY = "krelworld.slots.v1";

export function slotKey(id: SlotId): string {
  return id === "auto" ? AUTO_KEY : `${AUTO_KEY}.slot${id}`;
}

export function slotLabel(id: SlotId): string {
  return id === "auto" ? "AUTO" : `SLOT ${id}`;
}

/** Anything that parses a slot ("auto", 1-3, "1"...) or null. */
export function parseSlot(v: unknown): SlotId | null {
  if (v === "auto") return "auto";
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** h:mm (or m:ss under a minute's worth of nothing: still h:mm, "0:00"). */
export function formatPlaytime(ms: number): string {
  const mins = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 60000));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today 14:05", "Yesterday 09:12", "3 Nov 2026 · 22:40" (local time). Unknown (old saves): "". */
export function formatSavedAt(ts: number | undefined, now = Date.now()): string {
  if (!ts || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (t: number) => {
    const x = new Date(t);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  };
  if (day(ts) === day(now)) return `Today ${hm}`;
  if (day(ts) === day(now - 86400000)) return `Yesterday ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${hm}`;
}

export interface SlotSummary {
  id: SlotId;
  label: string;
  empty: boolean;
  player?: string;
  playerName?: string;
  chapter?: number;
  chapterTitle?: string;
  /** "CH 3 · THE CUDDLE CRONSTER" (or "THE END" for a finished run). */
  chapterLine?: string;
  where?: string;
  objective?: string;
  difficulty?: number;
  difficultyText?: string;
  ngPlus?: number;
  playtimeMs?: number;
  playtime?: string;
  coins?: number;
  savedAt?: number;
  savedText?: string;
}

/** What the LOAD list shows for one slot. Pure: everything comes from the save itself. */
export function summarizeSlot(id: SlotId, s: GameState | null, now = Date.now()): SlotSummary {
  const label = slotLabel(id);
  if (!s) return { id, label, empty: true };
  const ch = CHAPTERS.find((c) => c.n === s.chapter);
  const ended = s.phase === "ended";
  const diff = clampDifficulty(s.difficulty);
  return {
    id,
    label,
    empty: false,
    player: s.player,
    playerName: CHARACTERS[s.player]?.name ?? s.player,
    chapter: s.chapter,
    chapterTitle: ch?.title ?? "",
    chapterLine: ended ? "THE END · game complete" : `CH ${s.chapter}${ch ? ` · ${ch.title}` : ""}`,
    where: ended ? "The credits" : s.where || "Krelford",
    objective: ended ? undefined : s.objective || undefined,
    difficulty: diff,
    difficultyText: `Difficulty ${diff}/${MAX_DIFFICULTY}`,
    ngPlus: s.ngPlus || 0,
    playtimeMs: s.playtimeMs,
    playtime: formatPlaytime(s.playtimeMs),
    coins: s.coins,
    savedAt: s.savedAt,
    savedText: formatSavedAt(s.savedAt, now),
  };
}

/** The newest filled slot (CONTINUE loads it). Ties and undated old saves go to AUTO first, then slot order. */
export function mostRecentSlot(saves: { id: SlotId; s: GameState | null }[]): SlotId | null {
  let best: SlotId | null = null;
  let bestT = -Infinity;
  for (const { id, s } of saves) {
    if (!s) continue;
    const t = s.savedAt && Number.isFinite(s.savedAt) ? s.savedAt : 0;
    if (t > bestT) {
      best = id;
      bestT = t;
    }
  }
  return best;
}

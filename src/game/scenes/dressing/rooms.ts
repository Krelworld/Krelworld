import type { Kit } from "./kit";
import { wildern } from "./wildern";
import { polson } from "./polson";
import { ministry } from "./ministry";

/**
 * Per-room set dressing for the top-down dungeons: what the floor is, what's in the room, how it's lit and how it
 * sounds. Keyed `<dungeon id>:<room index>`. A room without an entry keeps the generic theme decor.
 */
export interface Dressing {
  /** a code-drawn floor (floors.ts name) or an existing texture key */
  floor?: string;
  floorTint?: number;
  floorScale?: number;
  /** tint the back and side walls */
  wallTint?: number;
  /** recorded ambience id (amb_<id>) instead of the theme's */
  ambience?: string;
  /** a weather loop on top (amb_rain...) */
  weather?: string;
  /** keep the generic theme decor too (e.g. Polson's lounge, already furnished) */
  keepGeneric?: boolean;
  build(k: Kit): void;
}

export const DRESSINGS: Record<string, Dressing> = {
  ...wildern,
  ...polson,
  ...ministry,
};

export function dressingFor(dungeonId: string, roomIdx: number): Dressing | null {
  // (debug: window.__noDress = true shows the undressed rooms, for before/after and frame-rate checks)
  if ((globalThis as { __noDress?: boolean }).__noDress) return null;
  return DRESSINGS[`${dungeonId}:${roomIdx}`] ?? null;
}

